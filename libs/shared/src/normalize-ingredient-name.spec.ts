import { describe, expect, it } from 'vitest';
import { normalizeIngredientDisplayName } from './normalize-ingredient-name';

describe('normalizeIngredientDisplayName', () => {
  it('strips amounts and optional suffixes', () => {
    expect(normalizeIngredientDisplayName('Итальянские травы 1 ч. л.')).toBe('Итальянские травы');
    expect(normalizeIngredientDisplayName('Кокосовая стружка по желанию')).toBe('Кокосовая стружка');
    expect(normalizeIngredientDisplayName('Кумин 1 ст. л.')).toBe('Кумин');
    expect(normalizeIngredientDisplayName('Масло ГХИ 1 ст. л.')).toBe('Масло ГХИ');
    expect(normalizeIngredientDisplayName('Мускатный орех 1 щепотка')).toBe('Мускатный орех');
    expect(normalizeIngredientDisplayName('Лайм 2 долька')).toBe('Лайм');
    expect(normalizeIngredientDisplayName('Лайм по желанию')).toBe('Лайм');
  });

  it('reorders conserved products and cleans cans', () => {
    expect(normalizeIngredientDisplayName('Консервированная сайра 1 банка /')).toBe(
      'Сайра консервированная',
    );
    expect(normalizeIngredientDisplayName('Консервированные сардины 1 банка /')).toBe(
      'Сардины консервированные',
    );
    expect(normalizeIngredientDisplayName('Консервированные шпроты')).toBe('Шпроты консервированные');
  });

  it('normalizes pepper shorthand and frying oil', () => {
    expect(normalizeIngredientDisplayName('Перец ч.м.')).toBe('Перец');
    expect(normalizeIngredientDisplayName('Масло рафинированное для жарки')).toBe(
      'Масло рафинированное',
    );
    expect(normalizeIngredientDisplayName('Панировочные сухари 1 стакан')).toBe('Панировочные сухари');
  });
});
