/**
 * Обновляет prepMinutes, cookMinutes, imageUrl и tags в recipes.seed.json по sourceUrl.
 * node apps/api/prisma/seeds/refresh-recipe-meta.mjs
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  fetchHtml,
  normalizeSourceUrl,
  parseRecipeMetaFromHtml,
  parseSourceTagsFromHtml,
} from './recipe-import-lib.mjs';

const require = createRequire(import.meta.url);
const { mapRecipeCategories } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');
const DELAY_MS = Number(process.env.RECIPE_META_DELAY_MS ?? 220);
const OPENVERSE_DELAY_MS = Number(process.env.RECIPE_OPENVERSE_DELAY_MS ?? 400);
const LIMIT = Number(process.env.RECIPE_META_LIMIT ?? 0);
const SKIP_OPENVERSE = process.env.RECIPE_SKIP_OPENVERSE === '1';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function imageSearchQuery(title) {
  return title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+вариант\s+\d+\s*$/i, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

async function fetchOpenverseImage(title) {
  const q = imageSearchQuery(title);
  if (!q || q.length < 3) return null;
  try {
    const url = new URL('https://api.openverse.engineering/v1/images/');
    url.searchParams.set('q', `${q} еда`);
    url.searchParams.set('page_size', '5');
    url.searchParams.set('license', 'cc0,pdm,by,by-sa');
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RecipeManagerSeed/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = (data.results ?? []).find((r) => r.url && r.thumbnail);
    return hit?.url ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
  let timeUpdates = 0;
  let imageUpdates = 0;
  let openverseHits = 0;

  const end = LIMIT > 0 ? Math.min(LIMIT, recipes.length) : recipes.length;
  for (let i = 0; i < end; i++) {
    const recipe = recipes[i];
    if (!recipe.sourceUrl) continue;

    const sourceUrl = normalizeSourceUrl(recipe.sourceUrl);
    process.stdout.write(`[${i + 1}/${recipes.length}] ${recipe.title.slice(0, 48)} … `);

    try {
      const html = await fetchHtml(sourceUrl);
      const meta = parseRecipeMetaFromHtml(html, sourceUrl);

      if (
        meta.prepMinutes !== recipe.prepMinutes ||
        meta.cookMinutes !== recipe.cookMinutes
      ) {
        recipe.prepMinutes = meta.prepMinutes;
        recipe.cookMinutes = meta.cookMinutes;
        timeUpdates++;
      }

      let imageUrl = meta.imageUrl ?? recipe.imageUrl ?? null;
      if (!imageUrl && !SKIP_OPENVERSE) {
        imageUrl = await fetchOpenverseImage(recipe.title);
        await sleep(OPENVERSE_DELAY_MS);
        if (imageUrl) openverseHits++;
      }

      if (imageUrl && imageUrl !== recipe.imageUrl) {
        recipe.imageUrl = imageUrl;
        imageUpdates++;
      }

      const sourceTags = parseSourceTagsFromHtml(html, sourceUrl);
      if (sourceTags.length) recipe.sourceTags = sourceTags;
      recipe.tags = mapRecipeCategories(
        recipe.title,
        sourceTags.length ? sourceTags : recipe.tags,
      );

      console.log('ok');
    } catch (e) {
      console.log('err', e.message);
      recipe.tags = mapRecipeCategories(recipe.title, recipe.sourceTags ?? recipe.tags);
    }

    if ((i + 1) % 20 === 0) {
      writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
    }

    await sleep(DELAY_MS);
  }

  writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
  console.log(
    `Done: time ${timeUpdates}, images ${imageUpdates} (+${openverseHits} Openverse), ${recipes.length} recipes.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
