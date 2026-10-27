/**
 * node apps/api/prisma/seeds/reclassify-user-batch-18.mjs
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const { normalizeIngredientDisplayName } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ingredientsPath = join(__dirname, 'ingredients.json');
const recipesPath = join(__dirname, 'recipes.seed.json');

const DELETE_SLUGS = new Set(['stebel-limonnogo-sorgo']);

const MERGE_SLUGS = {
  'sok-tomatnyy': 'tomatnyy-sok',
  'solenye-ogurtsy': 'ogurtsy-solenye',
};

const RENAME_BY_SLUG = {
  'tomatnyy-sok': 'Сок томатный',
};

const CATEGORY_BY_SLUG = {
  'tomatnyy-sok': 'прочее',
};

function addAlias(catalog, targetSlug, phrase) {
  const ing = catalog.find((x) => x.slug === targetSlug);
  if (!ing || !phrase) return;
  const key = phrase.toLowerCase().trim();
  const existing = new Set([ing.nameRu, ...(ing.aliases ?? [])].map((a) => a.toLowerCase().trim()));
  if (existing.has(key)) return;
  ing.aliases = [...(ing.aliases ?? []), phrase];
}

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const bySlug = new Map(catalog.map((x) => [x.slug, x]));

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

for (const [slug, nameRu] of Object.entries(RENAME_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.nameRu = nameRu;
}

for (const [slug, category] of Object.entries(CATEGORY_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.category = category;
}

for (const [from, to] of Object.entries(MERGE_SLUGS)) {
  const src = bySlug.get(from);
  if (src) addAlias(catalog, to, src.nameRu);
}
addAlias(catalog, 'tomatnyy-sok', 'Томатный сок');

let recipeMerged = 0;
let recipeDropped = 0;
for (const recipe of recipes) {
  const next = [];
  for (const ri of recipe.ingredients ?? []) {
    if (DELETE_SLUGS.has(ri.slug)) {
      recipeDropped++;
      continue;
    }
    const merged = MERGE_SLUGS[ri.slug];
    if (merged) {
      ri.slug = merged;
      recipeMerged++;
    }
    next.push(ri);
  }
  recipe.ingredients = next;
}

const removeSlugs = new Set([...DELETE_SLUGS, ...Object.keys(MERGE_SLUGS)]);
const before = catalog.length;
const nextCatalog = catalog.filter((ing) => !removeSlugs.has(ing.slug));

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

console.log(
  [
    `Catalog: ${before} → ${nextCatalog.length}`,
    `recipe merged: ${recipeMerged}, dropped: ${recipeDropped}`,
  ].join('\n'),
);

async function retireSlug(prisma, slug, migrateToSlug) {
  const retired = await prisma.ingredient.findUnique({ where: { slug } });
  if (!retired) return;
  let targetId = null;
  if (migrateToSlug) {
    const target = await prisma.ingredient.findUnique({ where: { slug: migrateToSlug } });
    targetId = target?.id ?? null;
  }
  if (targetId) {
    await prisma.pantryItem.updateMany({
      where: { ingredientId: retired.id },
      data: { ingredientId: targetId },
    });
    await prisma.shoppingListItem.updateMany({
      where: { ingredientId: retired.id },
      data: { ingredientId: targetId },
    });
    await prisma.recipeIngredient.updateMany({
      where: { ingredientId: retired.id },
      data: { ingredientId: targetId },
    });
  } else {
    await prisma.pantryItem.deleteMany({ where: { ingredientId: retired.id } });
    await prisma.recipeIngredient.deleteMany({ where: { ingredientId: retired.id } });
    await prisma.shoppingListItem.deleteMany({ where: { ingredientId: retired.id } });
  }
  await prisma.ingredientAlias.deleteMany({ where: { ingredientId: retired.id } });
  await prisma.ingredient.delete({ where: { id: retired.id } });
  console.log('DB retired', slug, migrateToSlug ? `→ ${migrateToSlug}` : '');
}

const prisma = new PrismaClient();
for (const slug of DELETE_SLUGS) {
  await retireSlug(prisma, slug);
}
for (const [from, to] of Object.entries(MERGE_SLUGS)) {
  await retireSlug(prisma, from, to);
}
for (const [slug, nameRu] of Object.entries(RENAME_BY_SLUG)) {
  await prisma.ingredient.updateMany({ where: { slug }, data: { nameRu } });
}
for (const [slug, category] of Object.entries(CATEGORY_BY_SLUG)) {
  await prisma.ingredient.updateMany({ where: { slug }, data: { category } });
}
await prisma.$disconnect();
console.log('DB sync done.');
