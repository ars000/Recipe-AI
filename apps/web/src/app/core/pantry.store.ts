import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  isDefaultAtHomeSlug,
  mergePantryWithAtHome,
  resolveAtHomeIdsFromCatalog,
} from '@recipe-manager/shared';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import type { Ingredient } from './models';

const STORAGE_KEY = 'recipe-manager-pantry-ids';

@Injectable({ providedIn: 'root' })
export class PantryStore {
  private readonly api = inject(ApiService);

  readonly allIngredients = signal<Ingredient[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly loading = signal(false);
  readonly search = signal('');

  private loadPromise: Promise<void> | null = null;
  private loaded = false;

  /** Каталог для UI «Продукты» (без соли и воды). */
  readonly pantryCatalogIngredients = computed(() =>
    (this.allIngredients() ?? []).filter(
      (i) => !isDefaultAtHomeSlug(i.slug),
    ),
  );

  readonly filteredIngredients = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.pantryCatalogIngredients();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.nameRu.toLowerCase().includes(q) ||
        i.slug.toLowerCase().includes(q),
    );
  });

  /** Явный выбор пользователя — для счётчика и списка на странице продуктов. */
  readonly pickedCount = computed(() => this.selectedIds().size);

  readonly defaultAtHomeIds = computed(() =>
    resolveAtHomeIdsFromCatalog(this.allIngredients() ?? []),
  );

  /** Учитывается при matchRecipes и AI; совпадает с API getEffectivePantryIds. */
  readonly effectivePantryIds = computed(() =>
    mergePantryWithAtHome(this.selectedIds(), this.defaultAtHomeIds()),
  );

  /** Явно отмеченные пользователем (без «всегда дома») — для Hero и списка выбора. */
  readonly pickedIngredients = computed(() => {
    const ids = this.selectedIds();
    return this.pantryCatalogIngredients()
      .filter((i) => ids.has(i.id))
      .sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru'));
  });

  /** Все «есть дома» для подбора рецептов (выбор + соль/вода по умолчанию). */
  readonly selectedIngredients = computed(() => {
    const ids = this.effectivePantryIds();
    return this.pantryCatalogIngredients()
      .filter((i) => ids.has(i.id))
      .sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru'));
  });

  constructor() {
    this.hydrateFromStorage();
    effect(() => {
      const ids = [...this.selectedIds()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    });
  }

  private hydrateFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as string[];
      this.selectedIds.set(new Set(parsed));
    } catch {
      /* ignore */
    }
  }

  ensureLoaded(): Promise<void> {
    if (this.loaded && this.allIngredients().length > 0) {
      return Promise.resolve();
    }
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.fetchCatalogAndMerge();
    return this.loadPromise;
  }

  private fetchCatalogAndMerge(): Promise<void> {
    this.loading.set(true);
    return new Promise((resolve) => {
      this.api.getIngredients().subscribe({
        next: (items) => {
          this.allIngredients.set(Array.isArray(items) ? items : []);
          this.selectedIds.update((set) =>
            this.pruneUnknownIngredientIds(this.withoutHiddenPantryIds(set)),
          );
          this.api.getPantry().subscribe({
            next: (pantry) => {
              const serverIds = (Array.isArray(pantry) ? pantry : []).map(
                (p) => p.ingredientId,
              );
              if (this.selectedIds().size === 0 && serverIds.length > 0) {
                this.selectedIds.set(
                  this.pruneUnknownIngredientIds(
                    this.withoutHiddenPantryIds(new Set(serverIds)),
                  ),
                );
              } else if (this.selectedIds().size > 0) {
                void this.syncPantry();
              }
              this.finishLoad(resolve);
            },
            error: () => {
              if (this.selectedIds().size > 0) {
                void this.syncPantry();
              }
              this.finishLoad(resolve);
            },
          });
        },
        error: () => {
          this.loading.set(false);
          this.loaded = true;
          resolve();
        },
      });
    });
  }

  private finishLoad(resolve: () => void) {
    this.loading.set(false);
    this.loaded = true;
    resolve();
  }

  load() {
    void this.ensureLoaded();
  }

  syncPantry(): Promise<void> {
    const ids = [...this.selectedIds()];
    return firstValueFrom(this.api.savePantry(ids)).then(() => undefined);
  }

  isDefaultAtHome(id: string): boolean {
    const item = (this.allIngredients() ?? []).find((i) => i.id === id);
    return item ? isDefaultAtHomeSlug(item.slug) : false;
  }

  /** Отмечено в UI «Продукты» (без неявных соль/вода). */
  isInPantry(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggle(id: string) {
    if (this.isDefaultAtHome(id)) return;
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    void this.syncPantry();
  }

  addIds(ids: string[]) {
    const addable = ids.filter((id) => !this.isHiddenPantryId(id));
    if (!addable.length) return;
    this.selectedIds.update((set) => {
      const next = new Set(set);
      addable.forEach((id) => next.add(id));
      return next;
    });
    void this.syncPantry();
  }

  removeId(id: string) {
    if (this.isDefaultAtHome(id)) return;
    if (!this.selectedIds().has(id)) return;
    this.selectedIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    void this.syncPantry();
  }

  clearAll(): Promise<void> {
    if (this.selectedIds().size === 0) return Promise.resolve();
    this.selectedIds.set(new Set());
    return this.syncPantry();
  }

  private isHiddenPantryId(id: string): boolean {
    const item = (this.allIngredients() ?? []).find((i) => i.id === id);
    return item ? isDefaultAtHomeSlug(item.slug) : false;
  }

  private withoutHiddenPantryIds(ids: Iterable<string>): Set<string> {
    return new Set([...ids].filter((id) => !this.isHiddenPantryId(id)));
  }

  /** Убирает id, которых больше нет в каталоге (после слияния дублей в seed). */
  private pruneUnknownIngredientIds(ids: Iterable<string>): Set<string> {
    const known = new Set((this.allIngredients() ?? []).map((i) => i.id));
    return new Set([...ids].filter((id) => known.has(id)));
  }
}
