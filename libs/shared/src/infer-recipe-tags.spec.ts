import { describe, expect, it } from 'vitest';
import { mapRecipeCategories, normalizeRecipeTags } from './infer-recipe-tags';

describe('mapRecipeCategories', () => {
  it('maps food.ru dessert tags for baked apples', () => {
    const sourceTags = [
      'десерты',
      'просто',
      'сборник рецептов',
      'рецепты с мёдом',
      'десерты в духовке',
      'полдник',
      'рецепты с грецкими орехами',
      'фруктовые десерты',
      'запеченные блюда',
      'горячие десерты',
    ];
    expect(mapRecipeCategories('Яблоки, запеченные с курагой и грецким орехом', sourceTags)).toEqual([
      'десерты',
    ]);
  });

  it('maps soup from title when no source tags', () => {
    expect(mapRecipeCategories('Суп с фрикадельками', null)).toEqual(['супы']);
  });

  it('keeps canonical tags from storage', () => {
    expect(
      normalizeRecipeTags('Что угодно', ['десерты', 'на ужин'], 10, 20),
    ).toEqual(['десерты']);
  });

  it('maps iamcook breadcrumb section (Закуски)', () => {
    expect(
      mapRecipeCategories('Жареные баклажаны с чесноком', [
        'Закуски',
        'жареные баклажаны с чесноком',
      ]),
    ).toEqual(['закуски']);
  });
});
