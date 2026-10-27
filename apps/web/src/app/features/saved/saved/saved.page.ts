import { Component, inject, OnInit, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';
import type { RecipeDetail } from '../../../core/models';
import { PageHeroComponent } from '../../../shared/ui/page-hero/page-hero.component';
import { RecipeCardComponent } from '../../../shared/ui/recipe-card/recipe-card.component';
import {
  difficultyLevel,
  recipeCategoryLabel,
  resolveRecipeTags,
  totalMinutes,
} from '../../../shared/recipe-ui.utils';

@Component({
  standalone: true,
  imports: [MatProgressSpinnerModule, PageHeroComponent, RecipeCardComponent],
  templateUrl: './saved.page.html',
})
export class SavedPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly recipes = signal<RecipeDetail[]>([]);
  readonly loading = signal(true);

  ngOnInit() {
    this.api.getSavedRecipes().subscribe({
      next: (r) => {
        this.recipes.set(Array.isArray(r) ? r : []);
        this.loading.set(false);
      },
      error: () => {
        this.recipes.set([]);
        this.loading.set(false);
      },
    });
  }

  toCard(r: RecipeDetail) {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      imageUrl: r.imageUrl,
      category: recipeCategoryLabel(
        r.title,
        r.tags,
        r.prepMinutes,
        r.cookMinutes,
        'Избранное',
      ),
      tags: resolveRecipeTags(r.title, r.tags, r.prepMinutes, r.cookMinutes),
      minutes: totalMinutes(r.prepMinutes, r.cookMinutes),
      level: difficultyLevel(r.prepMinutes, r.cookMinutes),
    };
  }
}
