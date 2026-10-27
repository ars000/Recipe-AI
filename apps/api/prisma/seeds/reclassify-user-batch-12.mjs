/**
 * Правки каталога (batch 12).
 * node apps/api/prisma/seeds/reclassify-user-batch-12.mjs
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
  'rediska',
  'ogurtsy-svezhie',
  'bulon-gribnoy',
  'marinovannye-griby',
  'rybnyy-bulon',
  'sahar-belyy',
  'smetana-zhirnaya',
  'sok-layma',
  'sok-limonnyy',
  'risovaya-bumaga',
]);

const RENAME_BY_SLUG = {
  'klubnichnyy-dzhem': 'Джем клубничный',
};

const CATEGORY_BY_SLUG = {
  'kapersy-marinovannye': 'бакалея',
};

function isSmetanaSlug(slug) {
  return slug === 'smetana' || slug.startsWith('smetana-');
}

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const bySlug = new Map(catalog.map((x) => [x.slug, x]));

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

for (const ing of catalog) {
  if (isSmetanaSlug(ing.slug) && !DELETE_SLUGS.has(ing.slug)) {
    ing.category = 'молочное';
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
    `recipe dropped refs: ${recipeDropped}`,
  ].join('\n'),
);
