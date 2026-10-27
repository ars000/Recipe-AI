import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import type { Ingredient } from '../../../core/models';
import { PantryStore } from '../../../core/pantry.store';
import { PageHeroComponent } from '../../../shared/ui/page-hero/page-hero.component';
import { FridgePhotoModalComponent } from '../../../shared/ui/fridge-photo-modal/fridge-photo-modal.component';
import {
  compareIngredientCategories,
  ingredientCategoryImage,
  ingredientCategoryLabel,
} from '../../../shared/ingredient-categories';
import { ingredientPantryLabel } from '../../../shared/ingredient-display.utils';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    RouterLink,
    PageHeroComponent,
    FridgePhotoModalComponent,
  ],
  templateUrl: './fridge.page.html',
  styleUrl: './fridge.page.scss',
})
export class FridgePage implements OnInit {
  readonly store = inject(PantryStore);
  readonly photoModalOpen = signal(false);
  search = '';

  grouped = computed(() => {
    const map = new Map<string, Ingredient[]>();
    for (const item of this.store.filteredIngredients()) {
      const cat = (item.category ?? 'прочее').toLowerCase();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    for (const items of map.values()) {
      items.sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru'));
    }
    return [...map.entries()]
      .sort(([a], [b]) => compareIngredientCategories(a, b))
      .map(([key, items]) => ({
        key,
        label: ingredientCategoryLabel(key),
        image: ingredientCategoryImage(key),
        items,
      }));
  });

  pantryLabel(nameRu: string): string {
    return ingredientPantryLabel(nameRu);
  }

  productCountLabel(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'продукт';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'продукта';
    return 'продуктов';
  }

  ngOnInit() {
    this.store.load();
  }

  clearSearch() {
    this.search = '';
    this.store.search.set('');
  }

  openPhotoModal() {
    this.photoModalOpen.set(true);
  }

  closePhotoModal() {
    this.photoModalOpen.set(false);
  }

  onPhotoConfirmed(ids: string[]) {
    this.store.addIds(ids);
    this.photoModalOpen.set(false);
  }
}
