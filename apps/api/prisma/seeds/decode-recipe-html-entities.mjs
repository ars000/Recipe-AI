/**
 * Заменяет HTML-мнемоники в description и steps всех рецептов seed.
 * node apps/api/prisma/seeds/decode-recipe-html-entities.mjs
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { decodeRecipeTextEntities } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');

function decodeField(value) {
  if (typeof value !== 'string' || !value.includes('&')) return value;
  let next = decodeRecipeTextEntities(value);
  while (next !== value && next.includes('&')) {
    value = next;
    next = decodeRecipeTextEntities(value);
  }
  return next;
}

const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));
let touched = 0;

for (const recipe of recipes) {
  let changed = false;
  if (recipe.description) {
    const d = decodeField(recipe.description);
    if (d !== recipe.description) {
      recipe.description = d;
      changed = true;
    }
  }
  if (Array.isArray(recipe.steps)) {
    recipe.steps = recipe.steps.map((step) => {
      const s = decodeField(String(step));
      if (s !== step) changed = true;
      return s;
    });
  }
  if (changed) touched++;
}

writeFileSync(seedPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
console.log(`Decoded HTML entities in ${touched}/${recipes.length} recipes.`);
