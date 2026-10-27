/**
 * Правки каталога (batch 4).
 * node apps/api/prisma/seeds/reclassify-user-batch-4.mjs
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { normalizeIngredientDisplayName } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ingredientsPath = join(__dirname, 'ingredients.json');
const recipesPath = join(__dirname, 'recipes.seed.json');

const DELETE_SLUGS = new Set([
  'bazilik-fioletovyy',
  'luk-zelenyy',
  'marinovannye-ogurtsy',
  'perya-zelenogo-luka',
  'petrushka-2-vetochka',
  'petrushka-zelen',
  'petrushka-koren',
  'pomidor-po-zhelaniyu',
  'pomidor-1-sht',
  'luk-marinovannyy',
  'apelsiny',
  'vinograd-bez-kostochek',
  'greypfruty',
  'vodorosli-chuka',
  'pryanosti',
  'kunzhut-tm-natsional',
  'kunzhutnye-semechki',
  'lapsha-pshenichnaya-ili-grechnevaya',
  'krasnyy-bolgarskiy-perets',
  'imbir-izmelchennyy',
  'imbir-svezhiy',
  'buket-garni',
  'imbir-koren',
  'molotyy-imbir',
  'molotaya-kurkuma',
  'perets-belyy-svezhemolotyy',
  'perets-sladkiy-krasnyy-molotyy',
  'pripravy',
  'priprava',
  'bulon',
  'kurinyy-bulon',
  'varenaya-govyadina',
  'vinnyy-uksus-belyy',
  'vinnyy-uksus-krasnyy',
  'vinnyy-uksussok-limona',
  'vinnyy-uksus',
  'glutamat-natriya',
  'gorchitsa-semena',
  'gorchitsa-tm-maheev',
  'gorchitsa-zerna',
  'grenki',
  'krekery',
  'kreker',
  'lepestki-pertsa-chili',
  'mayonez-legkiy',
  'moloko-pasterizovannoe-1-stakan',
  'olivki-bez-kostochki',
  'olivki-bez-kostochek',
  'pivo',
  'svetloe-pivo',
  'pischevoy-krasitel',
  'plavlenye-syrki',
  'plyus-rastitelnoe-maslo',
  'polutverdyy-syr',
  'pshenichnaya-lepeshka',
]);

const MERGE_SLUGS = {
  'koritsa-1-palochka': 'koritsa',
  'molotaya-paprika': 'paprika-molotaya',
  'molotyy-chernyy-perets': 'perets',
  'svezhemolotyy-chernyy-perets': 'perets',
  'kopchenaya-kolbasa': 'kolbasa-kopchenaya',
  'malenkiy-puchok-tarhuna': 'tarhun',
  'yaytsa-perepelinye': 'perepelinoe-yaytso',
  'yaytso-perepelinoe': 'perepelinoe-yaytso',
  'syr-plavlenyy': 'plavlenyy-syr',
  'pechen-indeyki': 'pechen',
  'pechen-kurinaya': 'pechen',
};

const RENAME_BY_SLUG = {
  'zamorozhennaya-vishnya': 'Вишня замороженная',
  'marinovannyy-imbir': 'Имбирь маринованный',
  'kolbasa-kopchenaya': 'Колбаса копченая',
  tarhun: 'Тархун свежий',
};

const CATEGORY_BY_SLUG = {
  'vinogradnye-listya': 'зелень',
  'oregano-sushenyy': 'зелень',
  tarhun: 'зелень',
  'perepelinoe-yaytso': 'молочное',
  'plavlenyy-syr': 'молочное',
  plombir: 'молочное',
  pechen: 'мясо',
};

function addAlias(catalog, targetSlug, phrase) {
  const ing = catalog.find((x) => x.slug === targetSlug);
  if (!ing || !phrase) return;
  const key = phrase.toLowerCase().trim();
  const existing = new Set([ing.nameRu, ...(ing.aliases ?? [])].map((a) => a.toLowerCase().trim()));
  if (existing.has(key)) return;
  ing.aliases = [...(ing.aliases ?? []), phrase];
}

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const bySlug = new Map(catalog.map((x) => [x.slug, x]));

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

for (const [slug, category] of Object.entries(CATEGORY_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.category = category;
}

for (const [slug, nameRu] of Object.entries(RENAME_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.nameRu = nameRu;
}

for (const [from, to] of Object.entries(MERGE_SLUGS)) {
  const src = bySlug.get(from);
  if (src) addAlias(catalog, to, src.nameRu);
}

let recipeMerged = 0;
let recipeDropped = 0;
for (const recipe of recipes) {
  const next = [];
  for (const ri of recipe.ingredients ?? []) {
    if (DELETE_SLUGS.has(ri.slug)) {
      recipeDropped++;
      continue;
    }
    const merged = MERGE_SLUGS[ri.slug];
    if (merged) {
      ri.slug = merged;
      recipeMerged++;
    }
    next.push(ri);
  }
  recipe.ingredients = next;
}

const removeSlugs = new Set([...DELETE_SLUGS, ...Object.keys(MERGE_SLUGS)]);
const before = catalog.length;
const nextCatalog = catalog.filter((ing) => !removeSlugs.has(ing.slug));

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

console.log(
  [
    `Catalog: ${before} → ${nextCatalog.length}`,
    `removed: ${removeSlugs.size}`,
    `recipe merged: ${recipeMerged}, dropped: ${recipeDropped}`,
  ].join('\n'),
);
