import {
  decodeRecipeTextEntities,
  formatShoppingListQuantity,
  normalizeRecipeTags,
  RECIPE_CATEGORY_LABELS,
} from '@recipe-manager/shared';

function displayCategoryLabel(tag: string): string {
  const key = tag.trim().toLowerCase().replace(/ё/g, 'е');
  const label =
    RECIPE_CATEGORY_LABELS?.[key as keyof typeof RECIPE_CATEGORY_LABELS];
  if (label) return label;
  if (!key) return tag;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Шаги рецепта из API (массив строк или JSON). */
export function decodeRecipeHtmlText(value: string): string {
  return decodeRecipeTextEntities(value);
}

export function coerceRecipeInstructions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((step) => {
      const raw = typeof step === 'string' ? step : step != null ? String(step) : '';
      return decodeRecipeHtmlText(raw);
    });
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return coerceRecipeInstructions(JSON.parse(trimmed));
    } catch {
      return [value];
    }
  }
  return [];
}

export function formatRecipeTags(tags?: string[] | null): string[] {
  if (!tags?.length) return [];
  return tags.map((t) => displayCategoryLabel(t));
}

export function resolveRecipeTags(
  title: string,
  tags?: string[] | null,
  prepMinutes?: number | null,
  cookMinutes?: number | null,
): string[] {
  return formatRecipeTags(
    normalizeRecipeTags(title, tags, prepMinutes, cookMinutes),
  );
}

export function recipeCategoryLabel(
  title: string,
  tags?: string[] | null,
  prepMinutes?: number | null,
  cookMinutes?: number | null,
  fallback = 'Рецепт',
): string {
  const resolved = resolveRecipeTags(title, tags, prepMinutes, cookMinutes);
  return resolved[0] ?? fallback;
}

/** Сложность (логика совпадает с @recipe-manager/shared/recipe-difficulty). */
export function difficultyLevel(prep?: number | null, cook?: number | null): string {
  const prepMin = prep ?? 0;
  const cookMin = cook ?? 0;
  const passive = Math.max(cookMin - 30, 0);
  const score = prepMin + Math.min(cookMin, 30) + passive * 0.25;
  if (score <= 50) return 'Легко';
  if (score <= 85) return 'Средне';
  return 'Сложно';
}

export function totalMinutes(prep?: number | null, cook?: number | null): number {
  return (prep ?? 0) + (cook ?? 0) || 30;
}

/** Человекочитаемое время: «1 ч 20 мин» или «25 мин». */
export function formatRecipeDuration(
  prep?: number | null,
  cook?: number | null,
): string {
  const total = totalMinutes(prep, cook);
  if (total >= 60) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  return `${total} мин`;
}

export function recipeMatchToCard(r: {
  recipeId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  canCookNow?: boolean;
  score: number;
  missing: Array<{ nameRu: string }>;
  used?: Array<{
    nameRu: string;
    inPantry: boolean;
    inPantryListed?: boolean;
    optional?: boolean;
  }>;
}) {
  const tags = resolveRecipeTags(r.title, r.tags, r.prepMinutes, r.cookMinutes);
  const inPantryProducts =
    r.used
      ?.filter((i) => i.inPantryListed ?? i.inPantry)
      .map((i) => i.nameRu) ?? [];
  const missingNames = (r.missing ?? []).map((m) => m.nameRu);
  const description = r.description?.trim()
    ? decodeRecipeHtmlText(r.description)
    : undefined;
  return {
    id: r.recipeId,
    title: r.title,
    description,
    imageUrl: r.imageUrl,
    category: tags[0],
    tags,
    minutes: totalMinutes(r.prepMinutes, r.cookMinutes),
    minutesLabel: formatRecipeDuration(r.prepMinutes, r.cookMinutes),
    level: difficultyLevel(r.prepMinutes, r.cookMinutes),
    badge: r.canCookNow ? 'Можно готовить' : undefined,
    scorePercent: Math.round(r.score * 100),
    inPantryProducts,
    missingProducts: missingNames,
  };
}

const UNIT_LABELS: Record<string, string> = {
  g: 'г',
  kg: 'кг',
  ml: 'мл',
  l: 'л',
  pcs: 'шт',
  tbsp: 'ст. л.',
  tsp: 'ч. л.',
  pinch: 'щепотка',
  clove: 'зуб.',
  slice: 'ломт.',
};

/** Единицы измерения для отображения (в t.ч. legacy g/pcs в БД). */
export function formatUnit(unit?: string | null): string {
  if (!unit) return '';
  const trimmed = unit.trim();
  const key = trimmed.toLowerCase();
  return UNIT_LABELS[key] ?? trimmed;
}

export function formatAmount(amount?: number | null): string {
  if (amount == null) return '';
  return Number.isInteger(amount) ? String(amount) : String(amount).replace(/\.?0+$/, '');
}

/** Строка количества для списка ингредиентов рецепта. */
export function formatRecipeIngredientAmount(
  amount?: number | null,
  unit?: string | null,
): string {
  if (amount == null) return '';
  const u = formatUnit(unit);
  if (!u) return formatAmount(amount);
  if (/^\(.+\)$/.test(u.trim()) || /\(.+\)/.test(u)) {
    return `${formatAmount(amount)} ${u}`;
  }
  return `${formatAmount(amount)} ${u}`;
}

export function isIngredientToTaste(unit?: string | null): boolean {
  return (unit?.trim().toLowerCase() ?? '') === 'по вкусу';
}

export interface ShoppingListQuantityInput {
  amount?: number | null;
  unit?: string | null;
  sources?: Array<{ amount?: number | null; unit?: string | null }>;
}

/** Количество в списке покупок (обёртка над shared + запасной формат). */
export function formatShoppingListItemQuantity(
  input: ShoppingListQuantityInput,
): string {
  if (typeof formatShoppingListQuantity === 'function') {
    try {
      return formatShoppingListQuantity(input);
    } catch {
      /* fallback below */
    }
  }

  const lines =
    input.sources && input.sources.length > 0
      ? input.sources
      : [{ amount: input.amount, unit: input.unit }];

  const hasTaste = lines.some((l) => isIngredientToTaste(l.unit));
  const numericParts = lines
    .filter((l) => l.amount != null && !isIngredientToTaste(l.unit))
    .map((l) => formatRecipeIngredientAmount(l.amount, l.unit))
    .filter(Boolean);

  const numericJoined = numericParts.length ? numericParts.join(' + ') : '';
  if (hasTaste && numericJoined) return `${numericJoined} + по вкусу`;
  if (hasTaste) return 'по вкусу';
  if (numericJoined) return numericJoined;

  const single = formatRecipeIngredientAmount(input.amount, input.unit);
  if (single) return single;
  if (isIngredientToTaste(input.unit)) return 'по вкусу';
  const unitOnly = formatUnit(input.unit);
  return unitOnly || '—';
}
