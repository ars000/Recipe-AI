/**
 * Импорт рецептов в recipes.seed.json (цель: 500 уникальных по sourceUrl).
 * node apps/api/prisma/seeds/import-recipes.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import {
  UA,
  fetchHtml,
  loadCatalog,
  normalizeSourceUrl,
  parseRecipeFromHtml,
  parseSourceTagsFromHtml,
  saveCatalog,
} from './recipe-import-lib.mjs';

const require = createRequire(import.meta.url);
const { mapRecipeCategories } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = Number(process.env.RECIPE_IMPORT_TARGET ?? 500);
const DELAY_MS = Number(process.env.RECIPE_IMPORT_DELAY_MS ?? 260);
const seedPath = join(__dirname, 'recipes.seed.json');
const sourcesPath = join(__dirname, 'recipe-sources.json');
const queuePath = join(__dirname, 'recipe-url-queue.json');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadIamcookUrls() {
  const map = JSON.parse(readFileSync(sourcesPath, 'utf8'));
  return Object.values(map).map(normalizeSourceUrl);
}

async function collectFoodRuUrls(limit) {
  const index = await (await fetch('https://food.ru/sitemap.xml', { headers: UA })).text();
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => /\/sitemaps\/recipes-\d+\.xml$/i.test(u));

  const urls = [];
  for (const sm of maps) {
    const xml = await (await fetch(sm, { headers: UA })).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = m[1];
      if (!/\/recipes\/\d+-/.test(u)) continue;
      urls.push(normalizeSourceUrl(u));
      if (urls.length >= limit) return urls;
    }
  }
  return urls;
}

async function collectIamcookScanUrls(limit, existing) {
  const ids = new Set();
  for (let id = 1; id <= 45000 && ids.size < limit; id += 29) {
    const url = normalizeSourceUrl(`https://www.iamcook.ru/showrecipe/${id}`);
    if (existing.has(url)) continue;
    const res = await fetch(url, { headers: UA });
    if (res.status !== 200) continue;
    const t = await res.text();
    if (t.includes('class="ingredients"')) ids.add(url);
    if (ids.size % 50 === 0) await sleep(80);
  }
  return [...ids];
}

async function buildUrlQueue(existingUrls, needCount) {
  const queue = [];
  const seen = new Set(existingUrls);

  const push = (url) => {
    const n = normalizeSourceUrl(url);
    if (seen.has(n)) return;
    seen.add(n);
    queue.push(n);
  };

  for (const u of loadIamcookUrls()) push(u);

  const foodNeed = Math.max(needCount + 200, 800);
  console.log(`Собираем URL food.ru (до ${foodNeed})…`);
  for (const u of await collectFoodRuUrls(foodNeed)) push(u);

  if (queue.length < needCount + 50) {
    console.log('Добираем URL iamcook сканированием…');
    for (const u of await collectIamcookScanUrls(needCount + 100, seen)) push(u);
  }

  writeFileSync(queuePath, JSON.stringify(queue, null, 2) + '\n', 'utf8');
  return queue.filter((u) => !existingUrls.has(u));
}

function isValidRecipe(recipe) {
  if (!recipe.title || recipe.title.length < 3) return false;
  if (!recipe.steps || recipe.steps.length < 2) return false;
  if (!recipe.ingredients || recipe.ingredients.length < 2) return false;
  return true;
}

async function main() {
  let recipes = [];
  try {
    recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
  } catch {
    recipes = [];
  }

  recipes = recipes.filter((r) => !/\s+вариант\s+\d+$/i.test(r.title));

  const byUrl = new Map();
  for (const r of recipes) {
    if (!r.sourceUrl) continue;
    byUrl.set(normalizeSourceUrl(r.sourceUrl), r);
  }
  recipes = [...byUrl.values()];

  const { catalog, slugLookup } = loadCatalog();
  let catalogDirty = false;

  const need = TARGET - byUrl.size;
  const queue = await buildUrlQueue(new Set(byUrl.keys()), need);
  console.log(`В очереди ${queue.length} URL, уже ${byUrl.size}, цель ${TARGET}`);

  let imported = 0;
  let failed = 0;

  for (const sourceUrl of queue) {
    if (byUrl.size >= TARGET) break;

    process.stdout.write(`[${byUrl.size + 1}/${TARGET}] ${sourceUrl} … `);

    try {
      const html = await fetchHtml(sourceUrl);
      const beforeLen = catalog.length;
      const parsed = parseRecipeFromHtml(html, sourceUrl, catalog, slugLookup);
      if (catalog.length > beforeLen) catalogDirty = true;

      const finalUrl = normalizeSourceUrl(parsed.canonicalUrl ?? sourceUrl);
      if (byUrl.has(finalUrl)) {
        console.log('skip (дубликат)');
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      if (!isValidRecipe(parsed)) {
        console.log('skip (неполный)');
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const sourceTags = parseSourceTagsFromHtml(html, finalUrl);
      const recipe = {
        title: parsed.title.trim(),
        sourceUrl: finalUrl,
        prepMinutes: parsed.prepMinutes,
        cookMinutes: parsed.cookMinutes,
        servings: parsed.servings,
        imageUrl: parsed.imageUrl ?? null,
        sourceTags,
        tags: mapRecipeCategories(parsed.title, sourceTags),
        ingredients: parsed.ingredients,
        steps: parsed.steps,
      };
      if (parsed.description) recipe.description = parsed.description;

      byUrl.set(finalUrl, recipe);
      recipes.push(recipe);
      imported++;
      console.log('ok', `"${recipe.title.slice(0, 52)}"`);

      if (imported % 25 === 0) {
        writeFileSync(seedPath, JSON.stringify([...byUrl.values()], null, 2) + '\n', 'utf8');
        if (catalogDirty) {
          saveCatalog(catalog);
          catalogDirty = false;
        }
      }
    } catch (e) {
      console.log('err', e.message);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  recipes = [...byUrl.values()];
  writeFileSync(seedPath, JSON.stringify(recipes, null, 2) + '\n', 'utf8');
  if (catalogDirty) saveCatalog(catalog);

  console.log(`Готово: ${recipes.length} рецептов (+${imported} новых, ${failed} пропусков).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
