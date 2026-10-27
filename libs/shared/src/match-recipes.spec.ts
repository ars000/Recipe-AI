import { describe, expect, it } from 'vitest';
import { matchRecipes } from './match-recipes';
import type { RecipeForMatch } from './types';

const recipes: RecipeForMatch[] = [
  {
    id: '1',
    title: 'Full match',
    ingredients: [
      { ingredientId: 'a', nameRu: 'A' },
      { ingredientId: 'b', nameRu: 'B' },
    ],
  },
  {
    id: '2',
    title: 'Partial',
    prepMinutes: 10,
    cookMinutes: 20,
    ingredients: [
      { ingredientId: 'a', nameRu: 'A' },
      { ingredientId: 'c', nameRu: 'C' },
    ],
  },
  {
    id: '3',
    title: 'Optional ignored',
    ingredients: [
      { ingredientId: 'a', nameRu: 'A' },
      { ingredientId: 'x', nameRu: 'X', optional: true },
    ],
  },
];

describe('matchRecipes', () => {
  it('sorts by score and missing count', () => {
    const result = matchRecipes(recipes, new Set(['a', 'b']));
    expect(result[0].recipeId).toBe('1');
    expect(result[0].canCookNow).toBe(true);
    expect(result[1].recipeId).toBe('3');
    expect(result[1].score).toBe(1);
    expect(result[2].recipeId).toBe('2');
    expect(result[2].missing).toHaveLength(1);
  });

  it('ignores default-at-home-only matches when explicit pantry is empty', () => {
    const saltWater: RecipeForMatch[] = [
      {
        id: 'sw',
        title: 'Only salt',
        ingredients: [
          { ingredientId: 'sol', nameRu: 'Соль' },
          { ingredientId: 'voda', nameRu: 'Вода' },
        ],
      },
      {
        id: 'mix',
        title: 'Salt and flour',
        ingredients: [
          { ingredientId: 'sol', nameRu: 'Соль' },
          { ingredientId: 'muka', nameRu: 'Мука' },
        ],
      },
    ];
    const effective = new Set(['sol', 'voda', 'muka']);
    const explicitEmpty = matchRecipes(saltWater, effective, {
      explicitPantryIds: [],
      defaultAtHomeIds: ['sol', 'voda'],
    });
    expect(explicitEmpty[0].matchedCount).toBe(0);
    expect(explicitEmpty[1].matchedCount).toBe(0);

    const explicitFlour = matchRecipes(saltWater, effective, {
      explicitPantryIds: ['muka'],
      defaultAtHomeIds: ['sol', 'voda'],
    });
    expect(explicitFlour[0].recipeId).toBe('mix');
    expect(explicitFlour[0].matchedCount).toBe(2);
    expect(explicitFlour[0].score).toBe(1);
  });

  it('scores all-optional recipes by every ingredient', () => {
    const onlyOptional: RecipeForMatch[] = [
      {
        id: 'x',
        title: 'Eggs',
        ingredients: [
          { ingredientId: 'egg', nameRu: 'Яйца', optional: true },
          { ingredientId: 'tom', nameRu: 'Помидор', optional: true },
        ],
      },
    ];
    const none = matchRecipes(onlyOptional, new Set(['tom']));
    expect(none[0].score).toBe(0.5);
    expect(none[0].matchedCount).toBe(1);
    const all = matchRecipes(onlyOptional, new Set(['egg', 'tom']));
    expect(all[0].canCookNow).toBe(true);
  });
});
