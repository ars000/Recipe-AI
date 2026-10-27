/**
 * Пересчитывает tags для рецептов с «разное» (хлебные крошки iamcook, sourceTags).
 * node apps/api/prisma/seeds/fix-misc-recipe-tags.mjs
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
const DELAY_MS = Number(process.env.RECIPE_META_DELAY_MS ?? 220);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isMiscOnly(tags) {
  return Array.isArray(tags) && tags.length === 1 && tags[0] === 'разное';
}

const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
let changed = 0;
let stillMisc = 0;

for (let i = 0; i < recipes.length; i++) {
  const recipe = recipes[i];
  if (!isMiscOnly(recipe.tags)) continue;

  let sourceTags = recipe.sourceTags ?? [];

  if (/iamcook\.ru/i.test(recipe.sourceUrl ?? '')) {
    try {
      const html = await fetchHtml(normalizeSourceUrl(recipe.sourceUrl));
      sourceTags = parseSourceTagsFromHtml(html, recipe.sourceUrl);
      recipe.sourceTags = sourceTags;
      await sleep(DELAY_MS);
    } catch (e) {
      console.warn(`fetch skip: ${recipe.title} — ${e.message}`);
    }
  }

  const tags = mapRecipeCategories(recipe.title, sourceTags);
  if (JSON.stringify(tags) !== JSON.stringify(recipe.tags)) {
    console.log(`${recipe.title}: разное → ${tags.join(', ')}`);
    recipe.tags = tags;
    changed++;
  } else {
    stillMisc++;
    console.log(`still разное: ${recipe.title}`);
  }
}

writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
console.log(`Done: ${changed} updated, ${stillMisc} still «разное».`);
