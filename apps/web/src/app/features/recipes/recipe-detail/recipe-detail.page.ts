import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import {
  MatSnackBar,
  MatSnackBarModule,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { isDefaultAtHomeSlug, matchRecipes } from '@recipe-manager/shared';
import { ApiService } from '../../../core/api.service';
import { PantryStore } from '../../../core/pantry.store';
import type { RecipeDetail } from '../../../core/models';
import { PageHeroComponent } from '../../../shared/ui/page-hero/page-hero.component';
import { ingredientPantryLabel } from '../../../shared/ingredient-display.utils';
import {
  coerceRecipeInstructions,
  decodeRecipeHtmlText,
  difficultyLevel,
  formatAmount,
  formatRecipeDuration,
  formatRecipeIngredientAmount,
  formatUnit,
  isIngredientToTaste,
  resolveRecipeTags,
  totalMinutes,
} from '../../../shared/recipe-ui.utils';

@Component({
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatSnackBarModule, PageHeroComponent],
  templateUrl: './recipe-detail.page.html',
  styleUrl: './recipe-detail.page.scss',
})
export class RecipeDetailPage implements OnInit {
  @ViewChild('favoriteSavedSnack')
  private favoriteSavedSnack!: TemplateRef<unknown>;

  @ViewChild('shoppingAddedSnack')
  private shoppingAddedSnack!: TemplateRef<unknown>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly pantry = inject(PantryStore);

  private openSnackRef: MatSnackBarRef<unknown> | null = null;

  readonly recipe = signal<RecipeDetail | null>(null);
  /** Отдельные signal для списков — стабильный рендер в @for (см. recipe-detail.page.html). */
  readonly instructionSteps = signal<string[]>([]);
  readonly ingredientRows = signal<RecipeDetail['ingredients']>([]);

  /** Совпадает с API /recipes/matched и кнопкой «В список покупок». */
  readonly recipeMatch = computed(() => {
    const r = this.recipe();
    if (!r) return null;
    const [match] = matchRecipes(
      [
        {
          id: r.id,
          title: r.title,
          prepMinutes: r.prepMinutes,
          cookMinutes: r.cookMinutes,
          ingredients: (r.ingredients ?? []).map((ri) => ({
            ingredientId: ri.ingredient?.id ?? '',
            nameRu: ri.ingredient?.nameRu ?? ri.labelRu ?? '',
            optional: ri.optional,
            amount: ri.amount,
            unit: ri.unit,
          })),
        },
      ],
      this.pantry.effectivePantryIds(),
      {
        explicitPantryIds: this.pantry.selectedIds(),
        defaultAtHomeIds: this.pantry.defaultAtHomeIds(),
      },
    );
    if (!match) return null;
    const missing = match.missing.filter(
      (m) => !this.isDefaultAtHomeRow(m.ingredientId, r.ingredients),
    );
    return {
      ...match,
      missing,
      canCookNow: missing.length === 0 && match.requiredCount > 0,
    };
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) return;
      void this.pantry.ensureLoaded().then(() => {
        void this.pantry.syncPantry();
        this.loadRecipe(id);
      });
    });
  }

  private loadRecipe(id: string) {
    this.recipe.set(null);
    this.instructionSteps.set([]);
    this.ingredientRows.set([]);
    this.api.getRecipe(id).subscribe({
      next: (raw) => {
        const data = this.normalizeRecipe(raw);
        this.recipe.set(data);
        this.instructionSteps.set(data.instructions);
        this.ingredientRows.set(data.ingredients);
      },
    });
  }

  private normalizeRecipe(raw: RecipeDetail): RecipeDetail {
    const data = JSON.parse(JSON.stringify(raw)) as RecipeDetail;
    const description = data.description?.trim()
      ? decodeRecipeHtmlText(data.description)
      : data.description;
    return {
      ...data,
      description,
      instructions: coerceRecipeInstructions(data.instructions),
      ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    };
  }

  totalMin(r: RecipeDetail) {
    return totalMinutes(r.prepMinutes, r.cookMinutes);
  }

  durationLabel(r: RecipeDetail) {
    return formatRecipeDuration(r.prepMinutes, r.cookMinutes);
  }

  level(r: RecipeDetail) {
    return difficultyLevel(r.prepMinutes, r.cookMinutes);
  }

  formatAmount = formatAmount;
  formatUnit = formatUnit;
  formatIngredientAmount = formatRecipeIngredientAmount;
  ingredientLabel(nameRu: string): string {
    return ingredientPantryLabel(nameRu);
  }

  ingredientLine(ri: RecipeDetail['ingredients'][number]): string {
    const name = this.ingredientLabel(ri.labelRu ?? ri.ingredient.nameRu);
    let line = name;
    if (ri.amount != null) {
      line += ` — ${formatRecipeIngredientAmount(ri.amount, ri.unit)}`;
    } else if (isIngredientToTaste(ri.unit)) {
      line += ' — по вкусу';
    }
    if (ri.optional && !isIngredientToTaste(ri.unit)) {
      line += ' (по желанию)';
    }
    return line;
  }
  isToTaste = isIngredientToTaste;

  displayTags(r: RecipeDetail) {
    return resolveRecipeTags(r.title, r.tags, r.prepMinutes, r.cookMinutes);
  }

  ingredientMissing(ri: RecipeDetail['ingredients'][number]) {
    if (this.isDefaultAtHomeIngredient(ri)) return false;
    const id = ri.ingredient?.id;
    if (!id) return true;
    return !this.pantry.isInPantry(id);
  }

  hasMissingIngredients() {
    return this.ingredientRows().some((ri) => this.ingredientMissing(ri));
  }

  private isDefaultAtHomeIngredient(
    ri: RecipeDetail['ingredients'][number],
  ): boolean {
    const slug = ri.ingredient?.slug;
    if (slug && isDefaultAtHomeSlug(slug)) return true;
    const id = ri.ingredient?.id;
    return id ? this.pantry.isDefaultAtHome(id) : false;
  }

  private isDefaultAtHomeRow(
    ingredientId: string,
    rows: RecipeDetail['ingredients'],
  ): boolean {
    const row = rows.find((ri) => ri.ingredient?.id === ingredientId);
    if (!row) return false;
    return this.isDefaultAtHomeIngredient(row);
  }

  dismissOpenSnack(): void {
    this.openSnackRef?.dismiss();
  }

  navigateFromShoppingSnack(): void {
    this.openSnackRef?.dismissWithAction();
  }

  private openAccentSnack(
    template: TemplateRef<unknown>,
    duration: number,
  ): MatSnackBarRef<unknown> {
    this.openSnackRef?.dismiss();
    const ref = this.snack.openFromTemplate(template, {
      duration,
      panelClass: ['snack-bar--accent'],
    });
    this.openSnackRef = ref;
    ref.afterDismissed().subscribe(() => {
      if (this.openSnackRef === ref) {
        this.openSnackRef = null;
      }
    });
    return ref;
  }

  save() {
    const id = this.recipe()?.id;
    if (!id) return;
    this.api
      .saveRecipe(id)
      .subscribe(() => this.openAccentSnack(this.favoriteSavedSnack, 2500));
  }

  addToShopping() {
    const id = this.recipe()?.id;
    if (!id) return;
    this.api.addShoppingFromRecipe(id).subscribe(() => {
      this.openAccentSnack(this.shoppingAddedSnack, 8000)
        .onAction()
        .subscribe(() => void this.router.navigate(['/shopping']));
    });
  }
}
