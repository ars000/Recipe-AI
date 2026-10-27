/**
 * Сливает дубль «Куриное бедро» (kurinoe-bedro) в kuritsa-bedro в БД и seed.
 * node apps/api/prisma/seeds/merge-kurinoe-bedro.mjs
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const FROM = 'kurinoe-bedro';
const TO = 'kuritsa-bedro';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ingredientsPath = join(__dirname, 'ingredients.json');
const recipesPath = join(__dirname, 'recipes.seed.json');

const prisma = new PrismaClient();
const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));

const fromIng = catalog.find((x) => x.slug === FROM);
const toIng = catalog.find((x) => x.slug === TO);
if (!fromIng || !toIng) {
  console.error('Catalog slugs not found', { FROM, TO });
  process.exit(1);
}

const fromRow = await prisma.ingredient.findUnique({ where: { slug: FROM } });
const toRow = await prisma.ingredient.findUnique({ where: { slug: TO } });
if (fromRow && toRow) {
  await prisma.pantryItem.updateMany({
    where: { ingredientId: fromRow.id },
    data: { ingredientId: toRow.id },
  });
  await prisma.recipeIngredient.updateMany({
    where: { ingredientId: fromRow.id },
    data: { ingredientId: toRow.id },
  });
  await prisma.shoppingListItem.updateMany({
    where: { ingredientId: fromRow.id },
    data: { ingredientId: toRow.id },
  });
  await prisma.ingredient.delete({ where: { id: fromRow.id } });
  console.log('DB: merged', FROM, '→', TO);
}

for (const recipe of recipes) {
  for (const ri of recipe.ingredients ?? []) {
    if (ri.slug === FROM) ri.slug = TO;
  }
}

const nextCatalog = catalog.filter((x) => x.slug !== FROM);
const toEntry = nextCatalog.find((x) => x.slug === TO);
if (toEntry && !toEntry.aliases.includes('куриное бедро')) {
  toEntry.aliases = [...(toEntry.aliases ?? []), 'куриное бедро'];
}

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
console.log('Seed files updated.');
await prisma.$disconnect();
