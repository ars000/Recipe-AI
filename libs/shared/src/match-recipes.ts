import type {
  MatchRecipesOptions,
  RecipeForMatch,
  RecipeMatchIngredient,
  RecipeMatchResult,
} from './types';

function toSet(ids?: Set<string> | string[]): Set<string> {
  if (!ids) return new Set();
  return ids instanceof Set ? ids : new Set(ids);
}

function buildUsedRow(
  i: RecipeForMatch['ingredients'][number],
  pantry: Set<string>,
  explicit: Set<string> | null,
  defaultAtHome: Set<string>,
  explicitMatchCount: number,
): RecipeMatchIngredient {
  const inPantry = pantry.has(i.ingredientId);
  const isExplicit = explicit?.has(i.ingredientId) ?? false;
  const isDefault = defaultAtHome.has(i.ingredientId);
  let inPantryListed = inPantry;
  if (explicit !== null) {
    if (explicitMatchCount === 0) {
      inPantryListed = false;
    } else {
      inPantryListed = isExplicit || (isDefault && inPantry);
    }
  } else if (isDefault) {
    inPantryListed = false;
  }
  return {
    ingredientId: i.ingredientId,
    nameRu: i.nameRu,
    inPantry,
    inPantryListed,
    optional: i.optional,
    amount: i.amount,
    unit: i.unit,
  };
}

export function matchRecipes(
  recipes: RecipeForMatch[],
  pantryIngredientIds: Set<string> | string[],
  options?: MatchRecipesOptions,
): RecipeMatchResult[] {
  const pantry = pantryIngredientIds instanceof Set
    ? pantryIngredientIds
    : new Set(pantryIngredientIds);

  const explicit = options?.explicitPantryIds
    ? toSet(options.explicitPantryIds)
    : null;
  const defaultAtHome = toSet(options?.defaultAtHomeIds);

  const results: RecipeMatchResult[] = recipes.map((recipe) => {
    const required = recipe.ingredients.filter((i) => !i.optional);
    const basis = required.length > 0 ? required : recipe.ingredients;
    const basisCount = basis.length;

    const explicitMatchCount =
      explicit === null
        ? 0
        : basis.filter((i) => explicit.has(i.ingredientId)).length;

    const used = basis.map((i) =>
      buildUsedRow(i, pantry, explicit, defaultAtHome, explicitMatchCount),
    );
    const missing = used.filter((i) => !i.inPantry);
    let matchedCount = basisCount - missing.length;
    let score = basisCount === 0 ? 0 : matchedCount / basisCount;

    if (explicit !== null && explicitMatchCount === 0) {
      matchedCount = 0;
      score = 0;
    }

    return {
      recipeId: recipe.id,
      title: recipe.title,
      score,
      matchedCount,
      requiredCount: basisCount,
      used,
      missing: missing.map((m) => ({
        ingredientId: m.ingredientId,
        nameRu: m.nameRu,
        amount: m.amount,
        unit: m.unit,
      })),
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      canCookNow: missing.length === 0 && basisCount > 0,
    };
  });

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.missing.length !== b.missing.length) {
      return a.missing.length - b.missing.length;
    }
    const timeA = (a.prepMinutes ?? 0) + (a.cookMinutes ?? 0);
    const timeB = (b.prepMinutes ?? 0) + (b.cookMinutes ?? 0);
    return timeA - timeB;
  });
}
