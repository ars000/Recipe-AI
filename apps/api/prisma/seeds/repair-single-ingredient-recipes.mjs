/**
 * Перепарсивает рецепты в seed с одним ингредиентом (часто после удаления slug без merge).
 * node apps/api/prisma/seeds/repair-single-ingredient-recipes.mjs
 */
import { createRequire } from 'module';
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

const require = createRequire(import.meta.url);
const { decodeRecipeTextEntities } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');
const DELAY_MS = 220;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeRecipeText(recipe) {
  if (recipe.description) {
    recipe.description = decodeRecipeTextEntities(recipe.description);
  }
  if (Array.isArray(recipe.steps)) {
    recipe.steps = recipe.steps.map((s) => decodeRecipeTextEntities(String(s)));
  }
}

async function main() {
  const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
  const { catalog, slugLookup } = loadCatalog();
  let catalogDirty = false;
  let fixed = 0;

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    if ((recipe.ingredients?.length ?? 0) !== 1 || !recipe.sourceUrl) continue;

    const sourceUrl = normalizeSourceUrl(recipe.sourceUrl);
    process.stdout.write(`${recipe.title.slice(0, 50)} … `);

    try {
      const html = await fetchHtml(sourceUrl);
      const beforeLen = catalog.length;
      const parsed = parseRecipeFromHtml(html, sourceUrl, catalog, slugLookup);
      if (catalog.length > beforeLen) catalogDirty = true;

      if (parsed.ingredients?.length > 1) {
        recipe.ingredients = parsed.ingredients;
        decodeRecipeText(recipe);
        fixed++;
        console.log(`ok (${parsed.ingredients.length} ing)`);
      } else {
        decodeRecipeText(recipe);
        console.log('unchanged');
      }
    } catch (e) {
      console.log('err', e.message);
    }

    await sleep(DELAY_MS);
  }

  writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
  if (catalogDirty) saveCatalog(catalog);
  console.log(`Fixed ${fixed} recipe(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
