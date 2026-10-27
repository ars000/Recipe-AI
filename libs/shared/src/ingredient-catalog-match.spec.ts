import { describe, expect, it } from 'vitest';
import {
  catalogEntryMatchesSourceName,
  decodeRecipeTextEntities,
  findCatalogSlugBySourceName,
  ingredientNamesEquivalent,
  resolveSlivkiCatalogSlug,
  scoreCatalogEntryForSourceName,
  suggestCatalogSlugsForSourceName,
  type CatalogIngredientRef,
} from './ingredient-catalog-match';

const catalog = [
  { slug: 'slivki', nameRu: 'Сливки', aliases: ['сливки 20%'] },
  { slug: 'slivki-35', nameRu: 'Сливки 35%', aliases: [] },
  { slug: 'slivki-33', nameRu: 'Сливки 33%', aliases: [] },
  { slug: 'gretskiy-oreh', nameRu: 'Грецкий орех', aliases: [] },
  { slug: 'orehi', nameRu: 'Орехи грецкие', aliases: ['грецкие орехи'] },
];

describe('ingredientNamesEquivalent', () => {
  it('matches regardless of word order and case', () => {
    expect(ingredientNamesEquivalent('Грецкий орех', 'орех грецкий')).toBe(true);
    expect(ingredientNamesEquivalent('Сливки жирные', 'жирные сливки')).toBe(true);
  });
});

describe('resolveSlivkiCatalogSlug', () => {
  it('maps heavy cream to generic slivki', () => {
    expect(resolveSlivkiCatalogSlug('сливки жирные', catalog)).toBe('slivki');
    expect(resolveSlivkiCatalogSlug('Сливки', catalog)).toBe('slivki');
  });

  it('maps percent variants when present in catalog', () => {
    expect(resolveSlivkiCatalogSlug('сливки 35%', catalog)).toBe('slivki-35');
    expect(resolveSlivkiCatalogSlug('сливки 33%', catalog)).toBe('slivki-33');
  });
});

describe('findCatalogSlugBySourceName', () => {
  it('resolves walnut by reordered words', () => {
    expect(findCatalogSlugBySourceName('орех грецкий', catalog)).toBe('gretskiy-oreh');
  });
});

describe('suggestCatalogSlugsForSourceName', () => {
  it('suggests walnut slug for colloquial wording', () => {
    const hits = suggestCatalogSlugsForSourceName('грецкие орехи', catalog);
    expect(hits.some((h) => h.slug === 'gretskiy-oreh' || h.slug === 'orehi')).toBe(true);
  });
});

describe('scoreCatalogEntryForSourceName', () => {
  const richCatalog: CatalogIngredientRef[] = [
    { slug: 'perets-bolg', nameRu: 'Перец болгарский', category: 'овощи' },
    { slug: 'perets-chern', nameRu: 'Перец чёрный молотый', category: 'бакалея' },
    { slug: 'sok-apels', nameRu: 'Сок апельсиновый', category: 'прочее' },
    { slug: 'gorbusha', nameRu: 'Горбуша в собственном соку', category: 'рыба' },
    { slug: 'govyadina', nameRu: 'Говядина', category: 'мясо', aliases: ['говядина кусок'] },
    { slug: 'sahar', nameRu: 'Сахар', category: 'бакалея', aliases: ['Мелкий сахарный песок'] },
  ];

  it('does not match «сок» inside песок, кусок or консервы в соку', () => {
    expect(scoreCatalogEntryForSourceName(richCatalog[3], 'сок')).toBe(0);
    expect(scoreCatalogEntryForSourceName(richCatalog[4], 'сок')).toBe(0);
    expect(scoreCatalogEntryForSourceName(richCatalog[5], 'сок')).toBe(0);
  });

  it('prefers juice and bell pepper for short names', () => {
    const juiceScore = scoreCatalogEntryForSourceName(richCatalog[2], 'сок');
    const pepperScore = scoreCatalogEntryForSourceName(richCatalog[0], 'перец');
    const spiceScore = scoreCatalogEntryForSourceName(richCatalog[1], 'перец');
    expect(juiceScore).toBeGreaterThan(30);
    expect(pepperScore).toBeGreaterThan(spiceScore);
  });
});

describe('catalogEntryMatchesSourceName', () => {
  it('matches alias and reordered name', () => {
    expect(catalogEntryMatchesSourceName(catalog[4], 'грецкие орехи')).toBe(true);
    expect(catalogEntryMatchesSourceName(catalog[3], 'Орех грецкий')).toBe(true);
  });
});

describe('decodeRecipeTextEntities', () => {
  it('replaces common HTML entities', () => {
    expect(decodeRecipeTextEntities('&laquo;текст&raquo; 3&ndash;5 &mdash; да')).toBe(
      '«текст» 3–5 — да',
    );
    expect(decodeRecipeTextEntities('&#8211; &#8212;')).toBe('– —');
  });
});
