/**
 * Правки каталога (batch 6).
 * node apps/api/prisma/seeds/reclassify-user-batch-6.mjs
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
  'svinaya-golova',
  'svinina-s-zhirkom',
  'svinoe-serdtse',
]);

const MERGE_SLUGS = {
  'kurdyuchnyy-zhir': 'kurdyuchnoe-salo',
};

const CATEGORY_BY_SLUG = {
  salo: 'мясо',
  'svinaya-grudinka': 'мясо',
  'svinaya-pechen': 'мясо',
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
