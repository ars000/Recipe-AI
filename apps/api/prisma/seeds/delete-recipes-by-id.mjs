/**
 * node apps/api/prisma/seeds/delete-recipes-by-id.mjs <uuid> [...]
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('Usage: delete-recipes-by-id.mjs <recipe-id> ...');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');
const prisma = new PrismaClient();

const sourceUrls = new Set();
for (const id of ids) {
  const row = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true, title: true, sourceUrl: true },
  });
  if (!row) {
    console.warn('Not in DB:', id);
    continue;
  }
  if (row.sourceUrl) sourceUrls.add(row.sourceUrl);
  await prisma.recipe.delete({ where: { id } });
  console.log('Deleted from DB:', row.title);
}

const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
const before = recipes.length;
const removedTitles = [];
const next = recipes.filter((r) => {
  if (r.sourceUrl && sourceUrls.has(r.sourceUrl)) {
    removedTitles.push(r.title);
    return false;
  }
  return true;
});

writeFileSync(seedPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
console.log(`Seed: ${before} → ${next.length}`);
if (removedTitles.length) console.log('Removed from seed:', removedTitles.join('; '));
await prisma.$disconnect();
