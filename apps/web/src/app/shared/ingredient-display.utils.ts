import { normalizeIngredientDisplayName } from '@recipe-manager/shared';

export function ingredientPantryLabel(nameRu: string): string {
  return normalizeIngredientDisplayName(nameRu);
}
