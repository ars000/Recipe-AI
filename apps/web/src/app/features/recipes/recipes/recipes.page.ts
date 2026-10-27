import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { normalizeRecipeTags, RECIPE_CATEGORY_TAGS } from '@recipe-manager/shared';
import { ApiService } from '../../../core/api.service';
import type { RecipeMatch } from '../../../core/models';
import { PantryStore } from '../../../core/pantry.store';
import { PageHeroComponent } from '../../../shared/ui/page-hero/page-hero.component';
import { RecipeCardComponent } from '../../../shared/ui/recipe-card/recipe-card.component';
import { formatRecipeTags, recipeMatchToCard } from '../../../shared/recipe-ui.utils';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    MatProgressSpinnerModule,
    PageHeroComponent,
    RecipeCardComponent,
  ],
  templateUrl: './recipes.page.html',
  styleUrl: './recipes.page.scss',
})
export class RecipesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly pantry = inject(PantryStore);

  readonly recipes = signal<RecipeMatch[]>([]);
  readonly loading = signal(true);
  readonly selectedTagKeys = signal<string[]>([]);

  readonly availableTagFilters = computed(() => {
    const counts = new Map<string, number>();
    for (const recipe of this.recipes()) {
      for (const key of this.recipeTagKeys(recipe)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const categoryTags = RECIPE_CATEGORY_TAGS ?? [];
    return categoryTags.filter((key) => counts.has(key)).map((key) => ({
      key,
      label: formatRecipeTags([key])[0] ?? key,
      count: counts.get(key) ?? 0,
    }));
  });

  readonly filteredRecipes = computed(() => {
    const selected = this.selectedTagKeys();
    const list = this.recipes() ?? [];
    if (!selected.length) return list;
    const need = new Set(selected);
    return list.filter((recipe) => {
      const tags = this.recipeTagKeys(recipe);
      return tags.some((t) => need.has(t));
    });
  });

  ngOnInit() {
    void this.loadMatches();
  }

  toggleTag(key: string) {
    this.selectedTagKeys.update((current) => {
      const set = new Set(current);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return [...set];
    });
  }

  isTagSelected(key: string): boolean {
    return this.selectedTagKeys().includes(key);
  }

  clearTagFilters() {
    this.selectedTagKeys.set([]);
  }

  private async loadMatches() {
    this.loading.set(true);
    try {
      await this.pantry.ensureLoaded();
      await this.pantry.syncPantry();
      this.api.getMatchedRecipes().subscribe({
        next: (data) => {
          this.recipes.set(Array.isArray(data) ? data : []);
          this.selectedTagKeys.set([]);
          this.loading.set(false);
        },
        error: () => {
          this.recipes.set([]);
          this.loading.set(false);
        },
      });
    } catch {
      this.loading.set(false);
    }
  }

  private recipeTagKeys(recipe: RecipeMatch): string[] {
    return normalizeRecipeTags(
      recipe.title,
      recipe.tags,
      recipe.prepMinutes,
      recipe.cookMinutes,
    );
  }

  toCard(r: RecipeMatch) {
    return recipeMatchToCard(r);
  }
}
