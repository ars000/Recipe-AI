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
const DELAY_MS = 200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
const { catalog, slugLookup } = loadCatalog();
let catalogDirty = false;
let n = 0;

for (const recipe of recipes) {
  if (!/food\.ru/i.test(recipe.sourceUrl ?? '')) continue;
  const sourceUrl = normalizeSourceUrl(recipe.sourceUrl);
  process.stdout.write(`${recipe.title.slice(0, 40)} … `);
  try {
    const html = await fetchHtml(sourceUrl);
    const before = catalog.length;
    const parsed = parseRecipeFromHtml(html, sourceUrl, catalog, slugLookup);
    if (catalog.length > before) catalogDirty = true;
    recipe.ingredients = parsed.ingredients;
    n++;
    console.log('ok');
  } catch (e) {
    console.log('err', e.message);
  }
  await sleep(DELAY_MS);
}

writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
if (catalogDirty) saveCatalog(catalog);
console.log(`Updated ${n} food.ru recipes.`);
