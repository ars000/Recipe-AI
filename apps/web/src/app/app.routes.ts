import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: 's/:token',
    loadComponent: () =>
      import('./features/shopping/shopping-share/shopping-share.page').then(
        (m) => m.ShoppingSharePage,
      ),
  },
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'fridge',
        loadComponent: () =>
          import('./features/fridge/fridge/fridge.page').then(
            (m) => m.FridgePage,
          ),
      },
      {
        path: 'recipes',
        loadComponent: () =>
          import('./features/recipes/recipes/recipes.page').then(
            (m) => m.RecipesPage,
          ),
      },
      {
        path: 'recipes/:id',
        loadComponent: () =>
          import('./features/recipes/recipe-detail/recipe-detail.page').then(
            (m) => m.RecipeDetailPage,
          ),
      },
      {
        path: 'ai',
        loadComponent: () =>
          import('./features/ai/ai-chef/ai-chef.page').then(
            (m) => m.AiChefPage,
          ),
      },
      {
        path: 'shopping',
        loadComponent: () =>
          import('./features/shopping/shopping/shopping.page').then(
            (m) => m.ShoppingPage,
          ),
      },
      {
        path: 'plan',
        loadComponent: () =>
          import('./features/meal-plan/meal-plan/meal-plan.page').then(
            (m) => m.MealPlanPage,
          ),
      },
      {
        path: 'saved',
        loadComponent: () =>
          import('./features/saved/saved/saved.page').then((m) => m.SavedPage),
      },
    ],
  },
];
