/**
 * Приводит nameRu в ingredients.json к коротким подписям для UI.
 * node apps/api/prisma/seeds/normalize-ingredient-names.mjs
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { normalizeIngredientDisplayName } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, 'ingredients.json');
const ingredients = JSON.parse(readFileSync(path, 'utf8'));
let changed = 0;

for (const ing of ingredients) {
  const next = normalizeIngredientDisplayName(ing.nameRu);
  if (next !== ing.nameRu) {
    ing.nameRu = next;
    changed++;
  }
}

writeFileSync(path, `${JSON.stringify(ingredients, null, 2)}\n`, 'utf8');
console.log(`Updated ${changed}/${ingredients.length} ingredient names.`);
