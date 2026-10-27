/**
 * Пересинхронизирует все рецепты в recipes.seed.json с sourceUrl:
 * описание, ингредиенты (как на сайте), шаги, время, картинка, заголовок.
 *
 * node apps/api/prisma/seeds/sync-recipes-from-source.mjs
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
const DELAY_MS = Number(process.env.RECIPE_SYNC_DELAY_MS ?? 220);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function applyParsed(recipe, parsed, sourceUrl) {
  if (parsed.title?.trim()) recipe.title = parsed.title.trim();
  recipe.sourceUrl = normalizeSourceUrl(parsed.canonicalUrl ?? sourceUrl);

  if (parsed.description) recipe.description = parsed.description;
  else delete recipe.description;

  if (parsed.prepMinutes != null) recipe.prepMinutes = parsed.prepMinutes;
  if (parsed.cookMinutes != null) recipe.cookMinutes = parsed.cookMinutes;
  if (parsed.servings != null) recipe.servings = parsed.servings;
  if (parsed.imageUrl) recipe.imageUrl = parsed.imageUrl;

  if (parsed.ingredients?.length >= 2) {
    recipe.ingredients = parsed.ingredients;
  }
  if (parsed.steps?.length >= 2) {
    recipe.steps = parsed.steps;
  }
}

async function main() {
  const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
  const { catalog, slugLookup } = loadCatalog();
  let catalogDirty = false;

  let ok = 0;
  let partial = 0;
  let fail = 0;

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    if (!recipe.sourceUrl) {
      fail++;
      continue;
    }

    const url = normalizeSourceUrl(recipe.sourceUrl);
    process.stdout.write(`[${i + 1}/${recipes.length}] ${recipe.title.slice(0, 42)}… `);

    try {
      const html = await fetchHtml(url);
      const before = catalog.length;
      const parsed = parseRecipeFromHtml(html, url, catalog, slugLookup);
      if (catalog.length > before) catalogDirty = true;

      const hadIng = parsed.ingredients?.length >= 2;
      const hadSteps = parsed.steps?.length >= 2;
      applyParsed(recipe, parsed, url);

      if (hadIng && hadSteps) {
        ok++;
        console.log('ok');
      } else {
        partial++;
        console.log('partial', { ing: parsed.ingredients?.length ?? 0, steps: parsed.steps?.length ?? 0 });
      }
    } catch (e) {
      fail++;
      console.log('err', e.message);
    }

    if ((i + 1) % 25 === 0) {
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

  console.log(`Готово: ${ok} полных, ${partial} частичных, ${fail} без URL/ошибок.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
