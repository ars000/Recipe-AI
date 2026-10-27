/**
 * Перепарсивает ингредиенты рецептов из sourceUrl (количества «2 шт. (120 г)» и т.д.).
 * node apps/api/prisma/seeds/refresh-recipe-ingredients.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  fetchHtml,
  loadCatalog,
  normalizeSourceUrl,
  parseRecipeFromHtml,
  saveCatalog,
} from './recipe-import-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');
const DELAY_MS = Number(process.env.RECIPE_INGREDIENT_DELAY_MS ?? 220);
const LIMIT = Number(process.env.RECIPE_INGREDIENT_LIMIT ?? 0);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
  const { catalog, slugLookup } = loadCatalog();
  let catalogDirty = false;
  let updated = 0;
  const end = LIMIT > 0 ? Math.min(LIMIT, recipes.length) : recipes.length;

  for (let i = 0; i < end; i++) {
    const recipe = recipes[i];
    if (!recipe.sourceUrl) continue;

    const sourceUrl = normalizeSourceUrl(recipe.sourceUrl);
    process.stdout.write(`[${i + 1}/${end}] ${recipe.title.slice(0, 46)} … `);

    try {
      const html = await fetchHtml(sourceUrl);
      const beforeLen = catalog.length;
      const parsed = parseRecipeFromHtml(html, sourceUrl, catalog, slugLookup);
      if (catalog.length > beforeLen) catalogDirty = true;

      if (parsed.ingredients?.length >= 2) {
        recipe.ingredients = parsed.ingredients;
        updated++;
        console.log('ok');
      } else {
        console.log('skip');
      }
    } catch (e) {
      console.log('err', e.message);
    }

    if ((i + 1) % 25 === 0) {
      writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
      if (catalogDirty) {
        saveCatalog(catalog);
        catalogDirty = false;
      }
    }

    await sleep(DELAY_MS);
  }

  writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
  if (catalogDirty) saveCatalog(catalog);
  console.log(`Updated ingredients for ${updated}/${end} recipes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
