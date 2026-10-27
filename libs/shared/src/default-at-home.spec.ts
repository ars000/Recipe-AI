import { describe, expect, it } from 'vitest';
import {
  isDefaultAtHomeSlug,
  isHiddenFromPantryCatalog,
  mergePantryWithAtHome,
  resolveAtHomeIdsFromCatalog,
} from './default-at-home';

describe('default-at-home', () => {
  it('resolves ids by slug', () => {
    const ids = resolveAtHomeIdsFromCatalog([
      { id: '1', slug: 'sol' },
      { id: '2', slug: 'sahar' },
      { id: '3', slug: 'voda' },
      { id: '4', slug: 'muka' },
    ]);
    expect(ids.sort()).toEqual(['1', '3']);
  });

  it('merges pantry with defaults', () => {
    const merged = mergePantryWithAtHome(['a'], ['b', 'c']);
    expect(merged.has('a')).toBe(true);
    expect(merged.has('b')).toBe(true);
    expect(merged.size).toBe(3);
  });

  it('recognizes default slugs', () => {
    expect(isDefaultAtHomeSlug('sol')).toBe(true);
    expect(isDefaultAtHomeSlug('muka')).toBe(false);
  });

  it('hides default-at-home from pantry catalog UI', () => {
    expect(isHiddenFromPantryCatalog('voda')).toBe(true);
    expect(isHiddenFromPantryCatalog('muka')).toBe(false);
  });
});
