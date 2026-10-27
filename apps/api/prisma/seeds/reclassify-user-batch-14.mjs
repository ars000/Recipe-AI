/**
 * Правки каталога (batch 14): соль/лавр, соусы, дубли.
 * node apps/api/prisma/seeds/reclassify-user-batch-14.mjs
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
  'lavr',
  'sol-chernyy-perets',
  'sol-chernyy-molotyy-perets',
]);

const MERGE_SLUGS = {
  'krevetki-korolevskie': 'krevetki',
  'nebolshaya-tykva': 'tikva',
  'kitayskaya-kapusta': 'kapusta-pekinskaya',
};

function shouldBeSaucesCategory(ing) {
  if (ing.category === 'соусы') return false;
  const n = ing.nameRu.toLowerCase();
  const s = ing.slug.toLowerCase();
  if (/соус/.test(n) || /(^|-)sous(-|$)/.test(s)) return true;
  if (/уксус/.test(n) || /(^|-)uksus(-|$)/.test(s) || s === 'ukus') return true;
  if (/майонез|mayonez/.test(n + s)) return true;
  if (/аджик|adzhika/.test(n + s)) return true;
  if (/кетчуп|ketchup/.test(n + s)) return true;
  if (/горчиц|gorchits/.test(n + s)) return true;
  return false;
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

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

let sauceMoves = 0;
for (const ing of catalog) {
  if (shouldBeSaucesCategory(ing)) {
    ing.category = 'соусы';
    sauceMoves++;
  }
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
    `sauces reclassified: ${sauceMoves}`,
    `recipe merged: ${recipeMerged}, dropped: ${recipeDropped}`,
  ].join('\n'),
);
