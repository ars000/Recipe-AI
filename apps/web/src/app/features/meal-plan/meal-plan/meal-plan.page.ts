import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../../../core/api.service';
import type { MealPlanEntry, RecipeMatch } from '../../../core/models';
import { PageHeroComponent } from '../../../shared/ui/page-hero/page-hero.component';

@Component({
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    PageHeroComponent,
  ],
  templateUrl: './meal-plan.page.html',
  styleUrl: './meal-plan.page.scss',
})
export class MealPlanPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly entries = signal<MealPlanEntry[]>([]);
  readonly recipes = signal<RecipeMatch[]>([]);

  selectedRecipeId = '';
  mealType: 'breakfast' | 'lunch' | 'dinner' = 'dinner';
  date = new Date().toISOString().slice(0, 10);

  ngOnInit() {
    this.reloadPlan();
    this.api
      .getMatchedRecipes(100)
      .subscribe((r) => this.recipes.set(Array.isArray(r) ? r : []));
  }

  mealLabel(type: string) {
    const map: Record<string, string> = {
      breakfast: 'Завтрак',
      lunch: 'Обед',
      dinner: 'Ужин',
    };
    return map[type] ?? type;
  }

  reloadPlan() {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
    this.api
      .getMealPlan(from, to)
      .subscribe((e) => this.entries.set(Array.isArray(e) ? e : []));
  }

  add() {
    if (!this.selectedRecipeId) return;
    this.api
      .setMealPlan(this.date, this.mealType, this.selectedRecipeId)
      .subscribe(() => this.reloadPlan());
  }
}
