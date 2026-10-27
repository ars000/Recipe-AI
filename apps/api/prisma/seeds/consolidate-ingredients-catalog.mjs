/**
 * Объединяет дубли каталога (лаваш и т.п.), чистит nameRu.
 * node apps/api/prisma/seeds/consolidate-ingredients-catalog.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { cleanIngredientName } from './recipe-import-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ingredientsPath = join(__dirname, 'ingredients.json');
const recipesPath = join(__dirname, 'recipes.seed.json');

const MERGE_SLUGS = {
  'armyanskiy-lavash-1-list': 'lavash',
  'armyanskiy-lavash-05-list': 'lavash',
  'armyanskiy-lavash-2-list': 'lavash',
  'armyanskiy-lavash-1-sht': 'lavash',
};

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));

if (!catalog.some((x) => x.slug === 'lavash')) {
  catalog.push({
    slug: 'lavash',
    nameRu: 'Армянский лаваш',
    category: 'бакалея',
    aliases: ['лаваш', 'армянский лаваш'],
  });
}

for (const ing of catalog) {
  ing.nameRu = cleanIngredientName(ing.nameRu);
}

const slugsToRemove = new Set(Object.keys(MERGE_SLUGS));
const nextCatalog = catalog.filter((ing) => !slugsToRemove.has(ing.slug));

let recipeReplacements = 0;
for (const recipe of recipes) {
  for (const ri of recipe.ingredients ?? []) {
    const target = MERGE_SLUGS[ri.slug];
    if (target) {
      ri.slug = target;
      recipeReplacements++;
    }
  }
}

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
console.log(
  `Catalog: ${catalog.length} → ${nextCatalog.length}, recipe slug fixes: ${recipeReplacements}`,
);
