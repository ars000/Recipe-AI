import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import type {
  GeneratedRecipe,
  Ingredient,
  MealPlanEntry,
  RecipeDetail,
  RecipeMatch,
  ShoppingList,
  ShoppingShareCreated,
  ShoppingShareSnapshot,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getIngredients() {
    return this.http.get<Ingredient[]>(`${this.base}/ingredients`);
  }

  getPantry() {
    return this.http.get<Array<{ ingredientId: string; ingredient: Ingredient }>>(
      `${this.base}/pantry`,
    );
  }

  savePantry(ingredientIds: string[]) {
    return this.http.put(`${this.base}/pantry`, { ingredientIds });
  }

  getMatchedRecipes(limit = 50) {
    return this.http.get<RecipeMatch[]>(
      `${this.base}/recipes?match=pantry&limit=${limit}`,
    );
  }

  getRecipe(id: string) {
    return this.http.get<RecipeDetail>(`${this.base}/recipes/${id}`);
  }

  saveRecipe(recipeId: string) {
    return this.http.post(`${this.base}/recipes/${recipeId}/save`, {});
  }

  getSavedRecipes() {
    return this.http.get<RecipeDetail[]>(`${this.base}/recipes/saved`);
  }

  createRecipe(body: unknown) {
    return this.http.post<RecipeDetail>(`${this.base}/recipes`, body);
  }

  generateRecipe(body: {
    pantryIngredientIds?: string[];
    constraints?: string;
  }) {
    return this.http.post<GeneratedRecipe>(`${this.base}/ai/generate-recipe`, body);
  }

  getShoppingList() {
    return this.http.get<ShoppingList>(`${this.base}/shopping-lists`);
  }

  addShoppingFromRecipe(recipeId: string) {
    return this.http.post<ShoppingList>(
      `${this.base}/shopping-lists/from-recipe/${recipeId}`,
      {},
    );
  }

  toggleShoppingItem(itemId: string, checked: boolean) {
    return this.http.patch(`${this.base}/shopping-lists/items/${itemId}`, {
      checked,
    });
  }

  deleteShoppingItem(itemId: string) {
    return this.http.delete<ShoppingList>(
      `${this.base}/shopping-lists/items/${itemId}`,
    );
  }

  clearShoppingList() {
    return this.http.post<ShoppingList>(`${this.base}/shopping-lists/clear`, {});
  }

  clearCheckedShoppingItems() {
    return this.http.post<ShoppingList>(
      `${this.base}/shopping-lists/clear-checked`,
      {},
    );
  }

  createShoppingShare() {
    return this.http.post<ShoppingShareCreated>(
      `${this.base}/shopping-lists/share`,
      {},
    );
  }

  getShoppingShare(token: string) {
    return this.http.get<ShoppingShareSnapshot>(
      `${this.base}/shopping-lists/share/${token}`,
    );
  }

  getMealPlan(from: string, to: string) {
    return this.http.get<MealPlanEntry[]>(
      `${this.base}/meal-plan?from=${from}&to=${to}`,
    );
  }

  setMealPlan(date: string, mealType: string, recipeId: string) {
    return this.http.post(`${this.base}/meal-plan`, { date, mealType, recipeId });
  }

  uploadFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ url: string }>(`${this.base}/upload`, fd);
  }

  recognizeProducts(imageUrl: string) {
    return this.http.post<Array<{ name: string; confidence?: number }>>(
      `${this.base}/ai/recognize-products`,
      { imageUrl },
    );
  }
}
