import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PantryStore } from '../../../core/pantry.store';
import type { Ingredient } from '../../../core/models';
import { ingredientPantryLabel } from '../../ingredient-display.utils';

@Component({
  selector: 'app-hero-product-search',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
  ],
  templateUrl: './hero-product-search.component.html',
  styleUrl: './hero-product-search.component.scss',
})
export class HeroProductSearchComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly store = inject(PantryStore);
  private readonly router = inject(Router);

  private readonly chipsEl = viewChild<ElementRef<HTMLElement>>('chipsEl');
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      this.store.pickedIngredients();
      queueMicrotask(() => this.measureChipOverflow());
    });
  }

  readonly query = new FormControl('', { nonNullable: true });
  readonly queryText = toSignal(this.query.valueChanges, { initialValue: '' });
  readonly syncing = signal(false);
  readonly chipsOverflow = signal(false);
  readonly hiddenChipCount = signal(0);

  readonly suggestions = computed(() => {
    const q = this.queryText().trim().toLowerCase();
    if (q.length < 2) return [];
    const list = this.store.pantryCatalogIngredients();
    return list
      .filter((i) => {
        const label = ingredientPantryLabel(i.nameRu).toLowerCase();
        return (
          label.includes(q) ||
          i.nameRu.toLowerCase().includes(q) ||
          i.slug.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  });

  pantryLabel(nameRu: string): string {
    return ingredientPantryLabel(nameRu);
  }

  ngOnInit() {
    void this.store.ensureLoaded();
  }

  ngAfterViewInit() {
    const el = this.chipsEl()?.nativeElement;
    if (!el) return;

    this.resizeObserver = new ResizeObserver(() => this.measureChipOverflow());
    this.resizeObserver.observe(el);
    this.measureChipOverflow();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  private measureChipOverflow() {
    const el = this.chipsEl()?.nativeElement;
    if (!el) {
      this.chipsOverflow.set(false);
      this.hiddenChipCount.set(0);
      return;
    }

    const hasOverflow = el.scrollHeight > el.clientHeight + 2;
    this.chipsOverflow.set(hasOverflow);

    if (!hasOverflow) {
      this.hiddenChipCount.set(0);
      return;
    }

    const clipBottom = el.getBoundingClientRect().bottom;
    const chips = el.querySelectorAll<HTMLElement>('.hero-search__chip:not(.hero-search__chip--more)');
    let visible = 0;
    chips.forEach((chip) => {
      if (chip.getBoundingClientRect().bottom <= clipBottom + 1) visible++;
    });
    this.hiddenChipCount.set(Math.max(0, chips.length - visible));
  }

  onPick(item: Ingredient) {
    this.store.addIds([item.id]);
    this.query.setValue('');
  }

  pickFirst(event: Event) {
    event.preventDefault();
    const first = this.suggestions()[0];
    if (first) this.onPick(first);
  }

  remove(id: string) {
    this.store.removeId(id);
  }

  clearAll() {
    void this.store.clearAll().then(() => {
      this.chipsOverflow.set(false);
      this.hiddenChipCount.set(0);
    });
  }

  async goRecipes() {
    this.syncing.set(true);
    try {
      await this.store.ensureLoaded();
      await this.store.syncPantry();
      await this.router.navigate(['/recipes']);
    } finally {
      this.syncing.set(false);
    }
  }
}
