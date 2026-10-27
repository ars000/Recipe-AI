/**
 * Правки каталога (batch 7).
 * node apps/api/prisma/seeds/reclassify-user-batch-7.mjs
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
  'podsolnechnoe-maslo-nerafinirovannoe',
  'podsolnechnoe-maslo-rafinirovannoe',
  'svinoe-file-myshtsa-kotoraya-vdol-pozvonochnika',
]);

const CATEGORY_BY_SLUG = {
  bekon: 'прочее',
};

function isOilInProchee(ing) {
  if (ing.category !== 'прочее') return false;
  if (/^masliny/i.test(ing.slug)) return false;
  if (/масло/i.test(ing.nameRu)) return true;
  if (/(^|-)maslo(-|$)/i.test(ing.slug)) return true;
  return false;
}

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const bySlug = new Map(catalog.map((x) => [x.slug, x]));

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

const oilMoves = [];
for (const ing of catalog) {
  if (isOilInProchee(ing)) {
    ing.category = 'соусы';
    oilMoves.push(ing.slug);
  }
}

for (const [slug, category] of Object.entries(CATEGORY_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.category = category;
}

let recipeDropped = 0;
for (const recipe of recipes) {
  const next = [];
  for (const ri of recipe.ingredients ?? []) {
    if (DELETE_SLUGS.has(ri.slug)) {
      recipeDropped++;
      continue;
    }
    next.push(ri);
  }
  recipe.ingredients = next;
}

const before = catalog.length;
const nextCatalog = catalog.filter((ing) => !DELETE_SLUGS.has(ing.slug));

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

console.log(
  [
    `Catalog: ${before} → ${nextCatalog.length}`,
    `removed: ${DELETE_SLUGS.size}`,
    `oils → соусы: ${oilMoves.length}`,
    oilMoves.join(', '),
    `recipe dropped refs: ${recipeDropped}`,
  ].join('\n'),
);
