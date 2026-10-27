/**
 * Правки каталога (batch 11).
 * node apps/api/prisma/seeds/reclassify-user-batch-11.mjs
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
  'selderey',
  'selderey-zelen',
  'rybnyy-sous-tayskiy',
  'rybnyy-sous-nam-pla',
  'sahar-trostnikovyy',
  'trostnikovyy-sahar',
  'sahar-palmovyy',
  'zhelatin-pischevoy',
]);

const MERGE_SLUGS = {
  'sladkiy-sous-chili': 'sous-chili-sladkiy',
  'slivochnyy-syr': 'syr-slivochnyy',
  'frantsuzskaya-gorchitsa': 'gorchitsa-frantsuzskaya',
  'slivki-zhirnye': 'slivki',
  'zhirnye-slivki': 'slivki',
  'slivki-35-zhirnosti-po-zhelaniyu': 'slivki-35',
};

const RENAME_BY_SLUG = {
  'slivki-35': 'Сливки 35%',
  'kopchenaya-skumbriya': 'Скумбрия копченая',
  'sloenoe-bezdrozhzhevoe-testo': 'Слоеное тесто бездрожжевое',
  'molochnyy-shokolad': 'Шоколад молочный',
  'gorkiy-shokolad': 'Шоколад горький',
  'rybnyy-sous': 'Соус рыбный',
};

const CATEGORY_BY_SLUG = {
  'smes-pertsev': 'зелень',
  'smes-neskolkih-vidov-pertsa': 'зелень',
  'koriandr-molotyy': 'зелень',
  'koriandr-semena': 'зелень',
  koriandr: 'зелень',
  'rybnyy-sous': 'соусы',
  gorchitsa: 'соусы',
  'neostraya-gorchitsa': 'соусы',
  'gorchitsa-s-zernami': 'соусы',
  'gorchitsa-dizhonskaya': 'соусы',
  'gorchitsa-frantsuzskaya': 'соусы',
  'gorchitsa-russkaya': 'соусы',
  'gorchitsa-ostraya': 'соусы',
  'syr-slivochnyy': 'молочное',
};

const GORCHITSA_SLUGS = /^gorchitsa(-|$)|^neostraya-gorchitsa$/;

function addAlias(catalog, targetSlug, phrase) {
  const ing = catalog.find((x) => x.slug === targetSlug);
  if (!ing || !phrase) return;
  const key = phrase.toLowerCase().trim();
  const existing = new Set([ing.nameRu, ...(ing.aliases ?? [])].map((a) => a.toLowerCase().trim()));
  if (existing.has(key)) return;
  ing.aliases = [...(ing.aliases ?? []), phrase];
}

function isDairyCreamSlug(slug) {
  return slug === 'slivki' || (slug.startsWith('slivki-') && slug !== 'kokosovye-slivki');
}

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const bySlug = new Map(catalog.map((x) => [x.slug, x]));

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

for (const ing of catalog) {
  if (isDairyCreamSlug(ing.slug) && !DELETE_SLUGS.has(ing.slug)) {
    ing.category = 'молочное';
  }
  if (GORCHITSA_SLUGS.test(ing.slug)) {
    ing.category = 'соусы';
  }
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
addAlias(catalog, 'slivki', 'сливки жирные');
addAlias(catalog, 'slivki', 'жирные сливки');

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
