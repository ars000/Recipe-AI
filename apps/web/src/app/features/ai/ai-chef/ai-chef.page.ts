import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';
import type { GeneratedRecipe } from '../../../core/models';
import { PantryStore } from '../../../core/pantry.store';
import { PageHeroComponent } from '../../../shared/ui/page-hero/page-hero.component';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    PageHeroComponent,
  ],
  templateUrl: './ai-chef.page.html',
  styleUrl: './ai-chef.page.scss',
})
export class AiChefPage {
  private readonly api = inject(ApiService);
  readonly pantry = inject(PantryStore);

  constraints = '';
  readonly loading = signal(false);
  readonly result = signal<GeneratedRecipe | null>(null);
  readonly error = signal('');

  generate() {
    this.loading.set(true);
    this.error.set('');
    this.api
      .generateRecipe({
        pantryIngredientIds: [...this.pantry.effectivePantryIds()],
        constraints: this.constraints,
      })
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(e.error?.message ?? 'AI недоступен. Проверьте API-ключ на сервере.');
          this.loading.set(false);
        },
      });
  }

  save() {
    const g = this.result();
    if (!g) return;
    this.api
      .createRecipe({
        title: g.title,
        description: g.description,
        instructions: g.steps,
        servings: g.servings,
        prepMinutes: g.prepMinutes,
        cookMinutes: g.cookMinutes,
        source: 'ai',
        tags: g.tags ?? ['ai'],
        ingredients: g.ingredients.map((i) => ({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
          optional: i.optional,
        })),
      })
      .subscribe();
  }
}
