import { describe, expect, it } from 'vitest';
import {
  dedupeMissingByIngredient,
  formatShoppingListQuantity,
  mergeShoppingLine,
  normalizeUnit,
  recipeIngredientDisplayName,
  recipeIngredientShoppingCustomName,
  shoppingItemKey,
} from './shopping-list';

describe('normalizeUnit', () => {
  it('maps Russian aliases', () => {
    expect(normalizeUnit('г')).toBe('g');
    expect(normalizeUnit('кг')).toBe('kg');
    expect(normalizeUnit('шт')).toBe('pcs');
  });
});

describe('shoppingItemKey', () => {
  it('uses ingredient id and unit', () => {
    expect(
      shoppingItemKey({ ingredientId: 'a', unit: 'g' }),
    ).toBe('i:a|g');
  });
});

describe('mergeShoppingLine', () => {
  it('sums same unit', () => {
    const merged = mergeShoppingLine(
      { ingredientId: 'x', amount: 200, unit: 'g' },
      { ingredientId: 'x', amount: 150, unit: 'g' },
    );
    expect(merged).toEqual({ amount: 350, unit: 'g' });
  });

  it('converts kg and g', () => {
    const merged = mergeShoppingLine(
      { ingredientId: 'x', amount: 1, unit: 'kg' },
      { ingredientId: 'x', amount: 500, unit: 'g' },
    );
    expect(merged).toEqual({ amount: 1.5, unit: 'kg' });
  });

  it('returns null for incompatible units', () => {
    expect(
      mergeShoppingLine(
        { ingredientId: 'x', amount: 2, unit: 'pcs' },
        { ingredientId: 'x', amount: 100, unit: 'g' },
      ),
    ).toBeNull();
  });

  it('merges amountless lines without summing', () => {
    const merged = mergeShoppingLine(
      { ingredientId: 'x', amount: null, unit: 'по вкусу' },
      { ingredientId: 'x', amount: 5, unit: 'по вкусу' },
    );
    expect(merged?.amount).toBe(5);
  });
});

describe('dedupeMissingByIngredient', () => {
  it('keeps first row per ingredientId', () => {
    const out = dedupeMissingByIngredient([
      { ingredientId: 'a', nameRu: 'A', amount: 1, unit: 'g' },
      { ingredientId: 'a', nameRu: 'A', amount: 99, unit: 'g' },
      { ingredientId: 'b', nameRu: 'B', amount: 2, unit: 'pcs' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].amount).toBe(1);
  });
});

describe('formatShoppingListQuantity', () => {
  it('shows по вкусу for taste-only', () => {
    expect(
      formatShoppingListQuantity({
        amount: null,
        unit: 'по вкусу',
        sources: [{ amount: null, unit: 'по вкусу' }],
      }),
    ).toBe('по вкусу');
  });

  it('combines numeric sum with по вкусу', () => {
    expect(
      formatShoppingListQuantity({
        amount: 80,
        unit: 'по вкусу',
        sources: [
          { amount: 80, unit: 'g' },
          { amount: null, unit: 'по вкусу' },
        ],
      }),
    ).toBe('80 г + по вкусу');
  });

  it('uses recipe label for display and shopping customName', () => {
    expect(recipeIngredientDisplayName('Лапша яичная', 'Лапша')).toBe(
      'Лапша яичная',
    );
    expect(
      recipeIngredientShoppingCustomName('Лапша яичная', 'Лапша'),
    ).toBe('Лапша яичная');
    expect(recipeIngredientShoppingCustomName('Соль', 'Соль')).toBeUndefined();
  });

  it('sums numeric sources only', () => {
    expect(
      formatShoppingListQuantity({
        amount: 350,
        unit: 'g',
        sources: [
          { amount: 200, unit: 'g' },
          { amount: 150, unit: 'g' },
        ],
      }),
    ).toBe('350 г');
  });
});
