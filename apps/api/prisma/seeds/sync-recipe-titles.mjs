/**
 * Сверяет и обновляет заголовки рецептов с iamcook.ru (как в <h1> на странице).
 * Запуск: node apps/api/prisma/seeds/sync-recipe-titles.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');
const sourcesPath = join(__dirname, 'recipe-sources.json');

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanSiteTitle(raw) {
  return decodeHtmlEntities(raw)
    .replace(/\s*—\s*рецепт\s+с\s+фото\s*$/i, '')
    .replace(/\s*-\s*iamcook.*$/i, '')
    .trim();
}

function extractTitleFromHtml(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return cleanSiteTitle(stripHtml(h1[1]));

  const og = html.match(/property="og:title"\s+content="([^"]+)"/i);
  if (og?.[1]) return cleanSiteTitle(og[1]);

  const titleTag = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleTag?.[1]) return cleanSiteTitle(stripHtml(titleTag[1]));

  return null;
}

function variantNumber(title) {
  const m = title.match(/вариант\s+(\d+)/i);
  return m ? Number(m[1]) : 0;
}

function buildTitle(originalTitle, variant) {
  if (variant > 1) return `${originalTitle} вариант ${variant}`;
  return originalTitle;
}

async function fetchTitle(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RecipeManagerSeed/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const title = extractTitleFromHtml(html);
  if (!title) throw new Error('title not found');
  return title;
}

const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
const urlCache = new Map();
const mismatches = [];
let updated = 0;

for (const recipe of recipes) {
  const url = recipe.sourceUrl;
  if (!url) continue;

  if (!urlCache.has(url)) {
    try {
      await new Promise((r) => setTimeout(r, 400));
      urlCache.set(url, await fetchTitle(url));
    } catch (e) {
      urlCache.set(url, null);
      console.warn(`Не удалось загрузить ${url}: ${e.message}`);
    }
  }

  const original = urlCache.get(url);
  if (!original) continue;

  const vNum = variantNumber(recipe.title);
  const expected = buildTitle(original, vNum);

  if (recipe.title !== expected) {
    mismatches.push({ from: recipe.title, to: expected, url });
    recipe.title = expected;
    updated++;
  }
}

writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

/** recipe-sources.json: один ключ на URL (без «вариант N»). */
const sources = {};
for (const recipe of recipes) {
  if (!recipe.sourceUrl) continue;
  const base = buildTitle(
    urlCache.get(recipe.sourceUrl) ?? recipe.title.replace(/\s+вариант\s+\d+$/i, '').trim(),
    0,
  );
  if (!sources[base]) sources[base] = recipe.sourceUrl;
}
writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, 'utf8');

console.log(`Обновлено заголовков: ${updated}/${recipes.length}`);
if (mismatches.length) {
  console.log('\nИзменения:');
  for (const m of mismatches) {
    console.log(`- "${m.from}" → "${m.to}"`);
  }
} else {
  console.log('Все заголовки совпадают с оригиналом (h1 на iamcook).');
}
