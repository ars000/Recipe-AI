import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';
import { PantryStore } from '../../../core/pantry.store';
import type { RecipeMatch } from '../../../core/models';
import { PageHeroComponent } from '../../../shared/ui/page-hero/page-hero.component';
import { RecipeCardComponent } from '../../../shared/ui/recipe-card/recipe-card.component';
import { recipeMatchToCard } from '../../../shared/recipe-ui.utils';
import { HeroProductSearchComponent } from '../../../shared/ui/hero-product-search/hero-product-search.component';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressSpinnerModule,
    PageHeroComponent,
    RecipeCardComponent,
    HeroProductSearchComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly pantry = inject(PantryStore);
  readonly featured = signal<RecipeMatch[]>([]);
  readonly loading = signal(true);

  ngOnInit() {
    void this.loadFeatured();
  }

  private async loadFeatured() {
    this.loading.set(true);
    try {
      await this.pantry.ensureLoaded();
      await this.pantry.syncPantry();
      if (this.pantry.selectedIds().size === 0) {
        this.featured.set([]);
        this.loading.set(false);
        return;
      }
      this.api.getMatchedRecipes(6).subscribe({
        next: (data) => {
          this.featured.set(Array.isArray(data) ? data : []);
          this.loading.set(false);
        },
        error: () => {
          this.featured.set([]);
          this.loading.set(false);
        },
      });
    } catch {
      this.loading.set(false);
    }
  }

  toCard(r: RecipeMatch) {
    return recipeMatchToCard(r);
  }
}
