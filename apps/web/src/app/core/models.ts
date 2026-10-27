export interface Ingredient {
  id: string;
  slug: string;
  nameRu: string;
  category: string | null;
  aliases?: string[];
}

export interface RecipeMatch {
  recipeId: string;
  title: string;
  score: number;
  matchedCount: number;
  requiredCount: number;
  missing: Array<{
    ingredientId: string;
    nameRu: string;
    amount?: number | null;
    unit?: string | null;
  }>;
  used?: Array<{
    ingredientId: string;
    nameRu: string;
    inPantry: boolean;
    optional?: boolean;
    amount?: number | null;
    unit?: string | null;
  }>;
  canCookNow: boolean;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
}

export interface RecipeDetail {
  id: string;
  title: string;
  description: string | null;
  instructions: string[];
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  imageUrl?: string | null;
  sourceUrl: string | null;
  source: string;
  tags: string[];
  ingredients: Array<{
    id?: string;
    labelRu?: string | null;
    amount: number | null;
    unit: string | null;
    optional: boolean;
    ingredient: Ingredient;
  }>;
}

export interface GeneratedRecipe {
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

export interface ShoppingListItemSource {
  id: string;
  recipeId: string;
  amount: number | null;
  unit: string | null;
  recipe: { id: string; title: string };
}

export interface ShoppingList {
  id: string;
  name: string;
  items: Array<{
    id: string;
    checked: boolean;
    amount: number | null;
    unit: string | null;
    customName: string | null;
    ingredient: Ingredient | null;
    sources: ShoppingListItemSource[];
  }>;
}

export interface ShoppingShareSnapshot {
  listName: string;
  sharedAt: string;
  items: Array<{
    name: string;
    amount: number | null;
    unit: string | null;
  }>;
}

export interface ShoppingShareCreated {
  token: string;
  expiresAt: string;
  payload: ShoppingShareSnapshot;
}

export interface MealPlanEntry {
  id: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  recipe: RecipeDetail;
}
