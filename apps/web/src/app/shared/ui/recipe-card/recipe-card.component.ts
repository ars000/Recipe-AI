import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface RecipeCardModel {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  category?: string;
  tags?: string[];
  minutes?: number;
  minutesLabel?: string;
  level?: string;
  badge?: string;
  scorePercent?: number;
  /** Продукты рецепта, которые уже отмечены в холодильнике */
  inPantryProducts?: string[];
  missingProducts?: string[];
}

@Component({
  selector: 'app-recipe-card',
  standalone: true,
  imports: [RouterLink, MatTooltipModule],
  templateUrl: './recipe-card.component.html',
  styleUrl: './recipe-card.component.scss',
})
export class RecipeCardComponent {
  recipe = input.required<RecipeCardModel>();
}
