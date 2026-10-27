export type RecipeSource = 'seed' | 'user' | 'ai';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface RecipeIngredientInput {
  ingredientId: string;
  nameRu: string;
  amount?: number | null;
  unit?: string | null;
  optional?: boolean;
  group?: string | null;
}

export interface RecipeForMatch {
  id: string;
  title: string;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients: RecipeIngredientInput[];
}

export interface MissingIngredient {
  ingredientId: string;
  nameRu: string;
  amount?: number | null;
  unit?: string | null;
}

export interface RecipeMatchIngredient {
  ingredientId: string;
  nameRu: string;
  /** Есть с учётом «всегда дома» (соль, вода). */
  inPantry: boolean;
  /** Показывать в «Есть дома» на карточке (только явный холодильник + соль/вода при других совпадениях). */
  inPantryListed?: boolean;
  optional?: boolean;
  amount?: number | null;
  unit?: string | null;
}

export interface RecipeMatchResult {
  recipeId: string;
  title: string;
  score: number;
  matchedCount: number;
  requiredCount: number;
  missing: MissingIngredient[];
  used: RecipeMatchIngredient[];
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  canCookNow: boolean;
}

/** Явный холодильник vs «всегда дома» (соль, вода) для подбора рецептов. */
export interface MatchRecipesOptions {
  explicitPantryIds?: Set<string> | string[];
  defaultAtHomeIds?: Set<string> | string[];
}

export interface GeneratedRecipeDto {
  title: string;
  description?: string;
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients: Array<{
    name: string;
    amount?: number;
    unit?: string;
    optional?: boolean;
  }>;
  steps: string[];
  tags?: string[];
}
