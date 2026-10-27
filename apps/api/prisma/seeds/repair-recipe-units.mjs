/**
 * Перепарсивает ингредиенты из sourceUrl и обновляет recipes.seed.json.
 * node apps/api/prisma/seeds/repair-recipe-units.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  fetchHtml,
  loadCatalog,
  parseRecipeFromHtml,
  saveCatalog,
} from './recipe-import-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');
const DELAY_MS = Number(process.env.RECIPE_REPAIR_DELAY_MS ?? 200);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
const { catalog, slugLookup } = loadCatalog();
let catalogDirty = false;

let ok = 0;
let fail = 0;

for (let i = 0; i < recipes.length; i++) {
  const recipe = recipes[i];
  if (!recipe.sourceUrl) continue;

  process.stdout.write(`[${i + 1}/${recipes.length}] ${recipe.title.slice(0, 40)}… `);

  try {
    const html = await fetchHtml(recipe.sourceUrl);
    const before = catalog.length;
    const parsed = parseRecipeFromHtml(html, recipe.sourceUrl, catalog, slugLookup);
    if (catalog.length > before) catalogDirty = true;

    if (parsed.ingredients?.length >= 2) {
      recipe.ingredients = parsed.ingredients;
      ok++;
      console.log('ok');
    } else {
      fail++;
      console.log('skip');
    }
  } catch (e) {
    fail++;
    console.log('err', e.message);
  }

  if ((i + 1) % 40 === 0) {
    writeFileSync(seedPath, JSON.stringify(recipes, null, 2) + '\n', 'utf8');
    if (catalogDirty) {
      saveCatalog(catalog);
      catalogDirty = false;
    }
  }

  await sleep(DELAY_MS);
}

writeFileSync(seedPath, JSON.stringify(recipes, null, 2) + '\n', 'utf8');
if (catalogDirty) saveCatalog(catalog);

console.log(`Готово: ${ok} обновлено, ${fail} пропусков.`);
