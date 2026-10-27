import { DecimalPipe } from '@angular/common';
import {
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FridgeScanLoaderComponent } from '../fridge-scan-loader/fridge-scan-loader.component';
import {
  findCatalogSlugBySourceName,
  suggestCatalogSlugsForSourceName,
  type CatalogIngredientRef,
} from '@recipe-manager/shared/ingredient-catalog-match';
import { ApiService } from '../../../core/api.service';
import type { Ingredient } from '../../../core/models';
import { ingredientPantryLabel } from '../../ingredient-display.utils';

type ModalStep = 'pick' | 'working' | 'review' | 'error';

export type FridgePhotoReviewItem = {
  id: string;
  nameRu: string;
  sourceName: string;
  confidence?: number;
  selected: boolean;
};

export type FridgePhotoSuggestionOption = {
  id: string;
  slug: string;
  nameRu: string;
  score: number;
};

export type FridgePhotoUnresolvedItem = {
  key: string;
  sourceName: string;
  confidence?: number;
  suggestions: FridgePhotoSuggestionOption[];
  pickedIngredientId: string | null;
  include: boolean;
};

export type FridgePhotoUnknownItem = {
  sourceName: string;
  confidence?: number;
};

@Component({
  selector: 'app-fridge-photo-modal',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatSelectModule,
    FridgeScanLoaderComponent,
  ],
  templateUrl: './fridge-photo-modal.component.html',
  styleUrl: './fridge-photo-modal.component.scss',
})
export class FridgePhotoModalComponent {
  readonly isOpen = input(false);
  readonly ingredients = input<Ingredient[]>([]);

  readonly closed = output<void>();
  readonly confirmed = output<string[]>();

  private readonly api = inject(ApiService);

  readonly step = signal<ModalStep>('pick');
  readonly workingLabel = signal('Загрузка фото…');
  readonly errorMessage = signal('');
  readonly previewUrl = signal<string | null>(null);
  readonly matched = signal<FridgePhotoReviewItem[]>([]);
  readonly unresolved = signal<FridgePhotoUnresolvedItem[]>([]);
  readonly unknown = signal<FridgePhotoUnknownItem[]>([]);

  private pendingFile: File | null = null;
  private previewObjectUrl: string | null = null;

  constructor() {
    effect(
      () => {
        if (this.isOpen()) {
          this.resetState();
        }
      },
      { allowSignalWrites: true },
    );
  }

  pantryLabel(nameRu: string): string {
    return ingredientPantryLabel(nameRu);
  }

  selectedCount(): number {
    const fromMatched = this.matched().filter((m) => m.selected).length;
    const fromUnresolved = this.unresolved().filter(
      (u) => u.include && u.pickedIngredientId,
    ).length;
    return fromMatched + fromUnresolved;
  }

  totalSelectableCount(): number {
    const unresolvedReady = this.unresolved().filter((u) => u.pickedIngredientId).length;
    return this.matched().length + unresolvedReady;
  }

  allSelectedForAdd(): boolean {
    const total = this.totalSelectableCount();
    return total > 0 && this.selectedCount() === total;
  }

  someSelectedForAdd(): boolean {
    const selected = this.selectedCount();
    const total = this.totalSelectableCount();
    return selected > 0 && selected < total;
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && !this.isWorking()) {
      this.requestClose();
    }
  }

  onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
    input.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) this.setFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  triggerFileInput(input: HTMLInputElement) {
    if (!this.isWorking()) input.click();
  }

  startRecognition() {
    const file = this.pendingFile;
    if (!file || this.isWorking()) return;

    this.step.set('working');
    this.workingLabel.set('Загрузка фото…');
    this.errorMessage.set('');

    this.api.uploadFile(file).subscribe({
      next: (res) => {
        this.workingLabel.set('Распознаём продукты…');
        this.api.recognizeProducts(res.url).subscribe({
          next: (products) => this.applyRecognition(products),
          error: (err) => this.failRecognition(err),
        });
      },
      error: (err) => this.failRecognition(err),
    });
  }

  toggleMatched(id: string, checked: boolean) {
    this.matched.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, selected: checked } : row)),
    );
  }

  selectAllForAdd(checked: boolean) {
    this.matched.update((rows) => rows.map((row) => ({ ...row, selected: checked })));
    this.unresolved.update((rows) =>
      rows.map((row) => ({
        ...row,
        include: checked && row.pickedIngredientId != null,
      })),
    );
  }

  toggleUnresolvedInclude(key: string, checked: boolean) {
    this.unresolved.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, include: checked } : row)),
    );
  }

  pickUnresolvedIngredient(key: string, ingredientId: string) {
    this.unresolved.update((rows) =>
      rows.map((row) =>
        row.key === key
          ? { ...row, pickedIngredientId: ingredientId, include: true }
          : row,
      ),
    );
  }

  confirm() {
    const ids = new Set<string>();
    for (const m of this.matched()) {
      if (m.selected) ids.add(m.id);
    }
    for (const u of this.unresolved()) {
      if (u.include && u.pickedIngredientId) ids.add(u.pickedIngredientId);
    }
    this.confirmed.emit([...ids]);
    this.requestClose();
  }

  requestClose() {
    if (this.isWorking()) return;
    this.closed.emit();
  }

  isWorking(): boolean {
    return this.step() === 'working';
  }

  private resetState() {
    this.revokePreview();
    this.pendingFile = null;
    this.step.set('pick');
    this.workingLabel.set('Загрузка фото…');
    this.errorMessage.set('');
    this.previewUrl.set(null);
    this.matched.set([]);
    this.unresolved.set([]);
    this.unknown.set([]);
  }

  private setFile(file: File) {
    this.revokePreview();
    this.pendingFile = file;
    this.previewObjectUrl = URL.createObjectURL(file);
    this.previewUrl.set(this.previewObjectUrl);
    this.step.set('pick');
    this.errorMessage.set('');
    this.matched.set([]);
    this.unresolved.set([]);
    this.unknown.set([]);
  }

  private revokePreview() {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  private catalogRefs(): CatalogIngredientRef[] {
    return this.ingredients().map((i) => ({
      slug: i.slug,
      nameRu: i.nameRu,
      aliases: i.aliases ?? [],
      category: i.category ?? null,
    }));
  }

  private ingredientBySlug(slug: string): Ingredient | undefined {
    return this.ingredients().find((i) => i.slug === slug);
  }

  private buildSuggestionOptions(
    slugs: ReturnType<typeof suggestCatalogSlugsForSourceName>,
  ): FridgePhotoSuggestionOption[] {
    const options: FridgePhotoSuggestionOption[] = [];
    for (const hit of slugs) {
      const ing = this.ingredientBySlug(hit.slug);
      if (!ing) continue;
      options.push({
        id: ing.id,
        slug: ing.slug,
        nameRu: ing.nameRu,
        score: hit.score,
      });
    }
    return options;
  }

  private applyRecognition(
    products: Array<{ name: string; confidence?: number }>,
  ) {
    const list = Array.isArray(products) ? products : [];
    const catalog = this.catalogRefs();
    const byId = new Map<string, FridgePhotoReviewItem>();
    const pending: FridgePhotoUnresolvedItem[] = [];
    const absent: FridgePhotoUnknownItem[] = [];

    for (const p of list) {
      const name = p.name?.trim();
      if (!name) continue;
      const confidence = p.confidence;

      const slug = findCatalogSlugBySourceName(name, catalog);
      if (slug) {
        const ing = this.ingredientBySlug(slug);
        if (!ing || byId.has(ing.id)) continue;
        byId.set(ing.id, {
          id: ing.id,
          nameRu: ing.nameRu,
          sourceName: name,
          confidence,
          selected: true,
        });
        continue;
      }

      const suggestions = this.buildSuggestionOptions(
        suggestCatalogSlugsForSourceName(name, catalog),
      );
      if (suggestions.length) {
        const top = suggestions[0];
        pending.push({
          key: name,
          sourceName: name,
          confidence,
          suggestions,
          pickedIngredientId: top.id,
          include: suggestions.length === 1 && top.score >= 28,
        });
      } else {
        absent.push({ sourceName: name, confidence });
      }
    }

    this.matched.set(
      [...byId.values()].sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru')),
    );
    this.unresolved.set(pending);
    this.unknown.set(absent);

    if (byId.size === 0 && pending.length === 0 && absent.length === 0) {
      this.errorMessage.set(
        'На фото не удалось найти продукты. Попробуйте другой снимок или отметьте вручную.',
      );
      this.step.set('error');
      return;
    }

    this.step.set('review');
  }

  private failRecognition(err: unknown) {
    const msg =
      (err as { error?: { message?: string | string[] } })?.error?.message ??
      'Не удалось обработать фото. Проверьте API и ключ OpenRouter.';
    this.errorMessage.set(
      Array.isArray(msg) ? msg.join(', ') : String(msg),
    );
    this.step.set('error');
  }
}
