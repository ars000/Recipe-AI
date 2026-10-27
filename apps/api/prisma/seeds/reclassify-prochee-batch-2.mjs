/**
 * Доработка «Прочее»: удаления, мясо, грибы, переименования.
 * node apps/api/prisma/seeds/reclassify-prochee-batch-2.mjs
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
  'kishki',
  'kipyatok',
  'konyak',
  'legkie',
  'lyubistok',
  'myaso',
  'pazhitnik-semena',
]);

const MERGE_SLUGS = {
  'kurinoe-file-tm-petruha': 'kurinoe-file',
  'file-kurinoy-grudki': 'kurinoe-file',
  'kurinye-goleni': 'kurinaya-golen',
  'kurinye-grudki': 'kuritsa-grudka',
  'kurinye-grudki-varenye': 'kuritsa-grudka',
  'kvas-semeynyy-sekret-traditsionnyy': 'kvas-2-l',
  'kvas-na-otrubyah': 'kvas-2-l',
  'kvas-hlebnyy': 'kvas-2-l',
  'ketchup-ostryy-tm-maheev': 'ketchup',
  'kefir-25': 'kefir',
  'kokosovoe-moloko-17': 'kokosovoe-moloko',
  'kurinye-yaytsa-4-shtuki': 'kurinoe-yaytso',
  'lavash-tonkiy': 'lavash',
  'limonnyy-sok-tm-sicilia': 'limonnyy-sok',
  'mayonez-tm-maheev': 'mayonez',
  'olivkovyy-mayonez-tm-maheev': 'mayonez-olivkovyy',
  'mayonez-sloboda-olivkovyy': 'mayonez-olivkovyy',
  'mintay-file': 'mintay',
  'nebolshoy-puchok-svezhego-oregano': 'oregano',
  'nerafinirovannoe-podsolnechnoeolivkovoe-maslo': 'maslo-oliv',
  'neboloshy-frantsuzskiy-baget': 'baget',
};

const MEAT_SLUGS = new Set([
  'govyadina-na-kosti',
  'govyazhya-pechen',
  'kurdyuchnoe-salo',
  'kurinoe-bedro',
  'kurinaya-golen',
  'kuritsa-grudka',
  'kurinyy-okorochok',
  'kuritsa',
  'kuritsa-domashnyaya',
  'kuritsa-varenaya',
  'kuritsa-kopchenaya',
  'osheek',
  'okorok',
  'kurinoe-file',
]);

const RENAME_BY_SLUG = {
  'kvas-2-l': 'Квас',
  'kusochki-ananasa-v-soke-del-monte': 'Кусочки ананаса в соке',
  'mayonez-sloboda-legkiy': 'Майонез легкий',
  'mayonez-olivkovyy': 'Майонез оливковый',
  'mayonez-na-perepelinyh-yaytsah-tm-maheev': 'Майонез на перепелиных яйцах',
  'mayonez-s-limonnym-sokom-tm-maheev': 'Майонез с лимонным соком',
  'mayoneznyy-sous-sloboda-postnyy': 'Майонезный соус постный',
  okorok: 'Окорок свиной',
  oregano: 'Свежий оregano',
};

const CATEGORY_BY_SLUG = {
  'kvas-2-l': 'прочее',
  'kusochki-ananasa-v-soke-del-monte': 'фрукты',
  kefir: 'молочное',
  'kokosovoe-moloko': 'молочное',
  'kurinoe-yaytso': 'молочное',
  lavash: 'бакалея',
  'limonnyy-sok': 'прочее',
  mayonez: 'соусы',
  'mayonez-sloboda-legkiy': 'соусы',
  'mayonez-olivkovyy': 'соусы',
  'mayonez-na-perepelinyh-yaytsah-tm-maheev': 'соусы',
  'mayonez-s-limonnym-sokom-tm-maheev': 'соусы',
  'mayoneznyy-sous-sloboda-postnyy': 'соусы',
  ketchup: 'соусы',
  mintay: 'рыба',
  oregano: 'зелень',
  'maslo-oliv': 'бакалея',
  baget: 'прочее',
  'kurinoe-file': 'мясо',
};

const NEW_INGREDIENTS = [
  {
    slug: 'kurinoe-file',
    nameRu: 'Куриное филе',
    category: 'мясо',
    aliases: ['куриное филе тм «петруха»', 'филе куриной грудки'],
  },
];

function isMushroom(ing) {
  if (ing.slug === 'bulon-gribnoy') return false;
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  return (
    /^grib|veshenk|lisichk|portobello|shampin|opyat|shiitake|mukhomor|truf|belye-grib/.test(
      ing.slug,
    ) || /гриб|шампиньон|вешенк|лисичк|опят|портобелло|шиитак|трюфел/.test(t)
  );
}

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

for (const ing of NEW_INGREDIENTS) {
  if (!bySlug.has(ing.slug)) {
    catalog.push(ing);
    bySlug.set(ing.slug, ing);
  }
}

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

for (const slug of MEAT_SLUGS) {
  const ing = bySlug.get(slug);
  if (ing) ing.category = 'мясо';
}

for (const ing of catalog) {
  if (isMushroom(ing)) ing.category = 'грибы';
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
    `грибы: ${nextCatalog.filter((x) => x.category === 'грибы').length}`,
    `прочее: ${nextCatalog.filter((x) => x.category === 'прочее').length}`,
    `recipe merged: ${recipeMerged}, dropped: ${recipeDropped}`,
  ].join('\n'),
);
