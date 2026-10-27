/** Ингредиенты, которые считаются «есть дома» без явной отметки в холодильнике. */
export const DEFAULT_AT_HOME_INGREDIENT_SLUGS = ['sol', 'voda'] as const;

export type DefaultAtHomeIngredientSlug =
  (typeof DEFAULT_AT_HOME_INGREDIENT_SLUGS)[number];

export function isDefaultAtHomeSlug(slug: string): boolean {
  return (DEFAULT_AT_HOME_INGREDIENT_SLUGS as readonly string[]).includes(slug);
}

/** Не показывать в «Продуктах», но считать «есть дома» при подборе рецептов. */
export function isHiddenFromPantryCatalog(slug: string): boolean {
  return isDefaultAtHomeSlug(slug);
}

export function resolveAtHomeIdsFromCatalog(
  catalog: ReadonlyArray<{ id: string; slug: string }>,
): string[] {
  const slugs = new Set<string>(DEFAULT_AT_HOME_INGREDIENT_SLUGS);
  return catalog.filter((i) => slugs.has(i.slug)).map((i) => i.id);
}

export function mergePantryWithAtHome<T extends string>(
  pantryIds: Iterable<T>,
  atHomeIds: Iterable<T>,
): Set<T> {
  return new Set([...pantryIds, ...atHomeIds]);
}
