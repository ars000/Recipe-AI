/**
 * Импорт популярных рецептов с edimdoma.ru в recipes.seed.json.
 * node apps/api/prisma/seeds/import-edimdoma.mjs
 *
 * Переменные: EDIMDOMA_PER_TAG (по умолчанию 125), RECIPE_IMPORT_DELAY_MS (260).
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import {
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
const seedPath = join(__dirname, 'recipes.seed.json');
const PER_TAG = Number(process.env.EDIMDOMA_PER_TAG ?? 125);
const DELAY_MS = Number(process.env.RECIPE_IMPORT_DELAY_MS ?? 260);

const TAG_SOURCES = [
  {
    listUrl:
      'https://www.edimdoma.ru/retsepty/tags/161-supy-i-bulony?sorted=most_viewed',
    sourceCategory: 'Супы и бульоны',
  },
  {
    listUrl:
      'https://www.edimdoma.ru/retsepty/tags/165-osnovnye-blyuda?sorted=most_viewed',
    sourceCategory: 'Основные блюда',
  },
  {
    listUrl:
      'https://www.edimdoma.ru/retsepty/tags/425-salaty?sorted=most_viewed',
    sourceCategory: 'Салаты',
  },
  {
    listUrl:
      'https://www.edimdoma.ru/retsepty/tags/145-zakuski?sorted=most_viewed',
    sourceCategory: 'Закуски',
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function countExistingForCategory(byUrl, sourceCategory) {
  let n = 0;
  for (const recipe of byUrl.values()) {
    if (!/edimdoma\.ru/i.test(recipe.sourceUrl ?? '')) continue;
    const tags = recipe.sourceTags ?? [];
    if (tags.some((t) => normalizeCategoryLabel(t) === normalizeCategoryLabel(sourceCategory))) {
      n++;
    }
  }
  return n;
}

function normalizeCategoryLabel(value) {
  return String(value).trim().toLowerCase().replace(/ё/g, 'е');
}

function isValidRecipe(recipe) {
  if (!recipe.title || recipe.title.length < 3) return false;
  if (!recipe.steps || recipe.steps.length < 2) return false;
  if (!recipe.ingredients || recipe.ingredients.length < 2) return false;
  return true;
}

function extractRecipePathsFromListing(html) {
  return [...html.matchAll(/href="(\/retsepty\/\d+-[^"?#]+)"/g)].map((m) => m[1]);
}

async function collectUrlsFromTag(listUrl, limit) {
  const urls = [];
  const seen = new Set();
  const target = limit + Math.max(25, Math.ceil(limit * 0.15));

  for (let page = 1; page <= 15; page++) {
    const pageUrl = page === 1 ? listUrl : `${listUrl}&page=${page}`;
    const html = await fetchHtml(pageUrl);
    let addedOnPage = 0;
    for (const path of extractRecipePathsFromListing(html)) {
      const full = normalizeSourceUrl(`https://www.edimdoma.ru${path}`);
      if (seen.has(full)) continue;
      seen.add(full);
      urls.push(full);
      addedOnPage++;
    }
    if (urls.length >= target) break;
    if (addedOnPage === 0) break;
    await sleep(180);
  }

  return urls;
}

async function main() {
  let recipes = [];
  try {
    recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
  } catch {
    recipes = [];
  }

  const byUrl = new Map();
  for (const r of recipes) {
    if (!r.sourceUrl) continue;
    byUrl.set(normalizeSourceUrl(r.sourceUrl), r);
  }

  const { catalog, slugLookup } = loadCatalog();
  let catalogDirty = false;
  let imported = 0;
  let skipped = 0;

  for (const { listUrl, sourceCategory } of TAG_SOURCES) {
    console.log(`\n=== ${sourceCategory}: до ${PER_TAG} рецептов ===`);
    const queue = await collectUrlsFromTag(listUrl, PER_TAG);
    console.log(`Собрано ${queue.length} URL из листинга`);

    let tagImported = countExistingForCategory(byUrl, sourceCategory);
    let tagAddedThisRun = 0;
    for (const sourceUrl of queue) {
      if (tagImported >= PER_TAG) break;

      const norm = normalizeSourceUrl(sourceUrl);
      if (byUrl.has(norm)) {
        skipped++;
        continue;
      }

      process.stdout.write(
        `[${sourceCategory}] ${tagImported + 1}/${PER_TAG} ${norm} … `,
      );

      try {
        const html = await fetchHtml(sourceUrl);
        const beforeLen = catalog.length;
        const parsed = parseRecipeFromHtml(html, sourceUrl, catalog, slugLookup);
        if (catalog.length > beforeLen) catalogDirty = true;

        const finalUrl = normalizeSourceUrl(parsed.canonicalUrl ?? sourceUrl);
        if (byUrl.has(finalUrl)) {
          console.log('skip (дубликат)');
          skipped++;
          await sleep(DELAY_MS);
          continue;
        }

        if (!isValidRecipe(parsed)) {
          console.log('skip (неполный)');
          skipped++;
          await sleep(DELAY_MS);
          continue;
        }

        const sourceTags = [
          sourceCategory,
          ...parseSourceTagsFromHtml(html, finalUrl),
        ];
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

        byUrl.set(finalUrl, recipe);
        recipes.push(recipe);
        imported++;
        tagImported++;
        tagAddedThisRun++;
        console.log('ok', `"${recipe.title.slice(0, 52)}"`);

        if (imported % 20 === 0) {
          writeFileSync(seedPath, JSON.stringify([...byUrl.values()], null, 2) + '\n', 'utf8');
          if (catalogDirty) {
            saveCatalog(catalog);
            catalogDirty = false;
          }
        }
      } catch (e) {
        console.log('err', e.message);
        skipped++;
      }

      await sleep(DELAY_MS);
    }

    console.log(
      `Категория «${sourceCategory}»: ${tagImported}/${PER_TAG} (новых за запуск: ${tagAddedThisRun})`,
    );
    writeFileSync(seedPath, JSON.stringify([...byUrl.values()], null, 2) + '\n', 'utf8');
    if (catalogDirty) {
      saveCatalog(catalog);
      catalogDirty = false;
    }
  }

  console.log(
    `\nГотово: всего ${byUrl.size} рецептов в seed (+${imported} edimdoma, ${skipped} пропусков).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
