import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './page-hero.component.html',
  styleUrl: './page-hero.component.scss',
})
export class PageHeroComponent {
  heading = input.required<string>();
  subtitle = input<string>('');
  breadcrumbs = input<Array<{ label: string; link?: string }>>([]);
  /** Увеличенный hero для главной страницы */
  size = input<'default' | 'large'>('default');
  /** Фоновое фото (например, главное фото рецепта) */
  coverImage = input<string | null | undefined>(null);
}
