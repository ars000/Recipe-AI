/**
 * Назначает категории рецептам в recipes.seed.json.
 * По умолчанию подтягивает теги с sourceUrl (food.ru и др.).
 * Только по названию: RECIPE_TAGS_FROM_SOURCE=0
 * Запуск: node apps/api/prisma/seeds/assign-recipe-tags.mjs
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  fetchHtml,
  normalizeSourceUrl,
  parseSourceTagsFromHtml,
} from './recipe-import-lib.mjs';

const require = createRequire(import.meta.url);
const { mapRecipeCategories } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');
const FROM_SOURCE = process.env.RECIPE_TAGS_FROM_SOURCE !== '0';
const DELAY_MS = Number(process.env.RECIPE_TAG_DELAY_MS ?? 220);
const LIMIT = Number(process.env.RECIPE_TAG_LIMIT ?? 0);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
let changed = 0;
const end = LIMIT > 0 ? Math.min(LIMIT, recipes.length) : recipes.length;

for (let i = 0; i < end; i++) {
  const recipe = recipes[i];
  let sourceTags = recipe.sourceTags ?? null;

  if (FROM_SOURCE && recipe.sourceUrl) {
    try {
      const html = await fetchHtml(normalizeSourceUrl(recipe.sourceUrl));
      sourceTags = parseSourceTagsFromHtml(html, recipe.sourceUrl);
      recipe.sourceTags = sourceTags;
      process.stdout.write(`[${i + 1}/${end}] ${recipe.title.slice(0, 42)} … ok\n`);
    } catch (e) {
      process.stdout.write(`[${i + 1}/${end}] ${recipe.title.slice(0, 42)} … err ${e.message}\n`);
    }
    await sleep(DELAY_MS);
  }

  const hints = sourceTags?.length ? sourceTags : recipe.tags;
  const next = mapRecipeCategories(recipe.title, hints);
  const prev = JSON.stringify(recipe.tags ?? []);
  const nextStr = JSON.stringify(next);
  if (prev !== nextStr) changed++;
  recipe.tags = next;

  if (FROM_SOURCE && (i + 1) % 25 === 0) {
    writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
  }
}

writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
console.log(`Updated tags for ${changed}/${recipes.length} recipes.`);
