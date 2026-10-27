import type { MissingIngredient } from './types';

/** Канонические коды единиц (как в БД / recipe-ui). */
const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  г: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  кг: 'kg',
  ml: 'ml',
  мл: 'ml',
  l: 'l',
  л: 'l',
  pcs: 'pcs',
  pc: 'pcs',
  шт: 'pcs',
  tbsp: 'tbsp',
  tsp: 'tsp',
  pinch: 'pinch',
  щепотка: 'pinch',
  clove: 'clove',
  slice: 'slice',
  'по вкусу': 'по вкусу',
};

export interface ShoppingLineInput {
  ingredientId?: string | null;
  customName?: string | null;
  amount?: number | null;
  unit?: string | null;
}

export interface ShoppingLineMerged {
  amount: number | null;
  unit: string | null;
}

export function normalizeUnit(unit?: string | null): string | null {
  if (unit == null) return null;
  const trimmed = unit.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  return UNIT_ALIASES[key] ?? UNIT_ALIASES[trimmed] ?? key;
}

export function isAmountlessUnit(unit?: string | null): boolean {
  const n = normalizeUnit(unit);
  return n === 'по вкусу' || n === null;
}

export function isToTasteUnit(unit?: string | null): boolean {
  return normalizeUnit(unit) === 'по вкусу';
}

const DISPLAY_UNIT: Record<string, string> = {
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

function formatAmountValue(amount: number): string {
  return Number.isInteger(amount)
    ? String(amount)
    : String(amount).replace(/\.?0+$/, '');
}

function formatAmountWithUnit(amount: number, unit?: string | null): string {
  const key = normalizeUnit(unit);
  if (!key || key === 'по вкусу') return formatAmountValue(amount);
  const label = DISPLAY_UNIT[key] ?? unit?.trim() ?? key;
  return `${formatAmountValue(amount)} ${label}`;
}

export interface ShoppingQuantitySource {
  amount?: number | null;
  unit?: string | null;
}

/** Количество для строки списка покупок (с учётом «по вкусу» и нескольких рецептов). */
export function formatShoppingListQuantity(input: {
  amount?: number | null;
  unit?: string | null;
  sources?: ShoppingQuantitySource[];
}): string {
  const lines: ShoppingQuantitySource[] =
    input.sources && input.sources.length > 0
      ? input.sources
      : [{ amount: input.amount, unit: input.unit }];

  const hasTaste = lines.some((l) => isToTasteUnit(l.unit));
  const numericLines = lines.filter(
    (l) => l.amount != null && !isToTasteUnit(l.unit),
  );

  let numericPart = '';
  if (numericLines.length > 0) {
    let acc: ShoppingLineMerged | null = null;
    for (const line of numericLines) {
      const incoming = {
        ingredientId: 'sum',
        amount: line.amount,
        unit: line.unit,
      };
      if (acc == null) {
        acc = { amount: line.amount ?? null, unit: line.unit ?? null };
        continue;
      }
      const merged = mergeShoppingLine(
        { ingredientId: 'sum', amount: acc.amount, unit: acc.unit },
        incoming,
      );
      if (merged) acc = merged;
    }
    if (acc?.amount != null) {
      numericPart = formatAmountWithUnit(acc.amount, acc.unit);
    }
  }

  if (hasTaste && numericPart) return `${numericPart} + по вкусу`;
  if (hasTaste) return 'по вкусу';
  if (numericPart) return numericPart;

  if (lines.length === 1 && isToTasteUnit(lines[0].unit)) return 'по вкусу';
  if (input.amount != null && !isToTasteUnit(input.unit)) {
    return formatAmountWithUnit(input.amount, input.unit);
  }
  if (isToTasteUnit(input.unit)) return 'по вкусу';

  const unitLabel = input.unit?.trim();
  if (unitLabel) {
    const key = normalizeUnit(input.unit);
    if (key && key !== 'по вкусу') {
      return DISPLAY_UNIT[key] ?? unitLabel;
    }
  }

  return '—';
}

/** Базовая единица для суммирования (масса → g, объём → ml). */
function toBaseAmount(amount: number, unit: string): { amount: number; unit: string } | null {
  switch (unit) {
    case 'g':
      return { amount, unit: 'g' };
    case 'kg':
      return { amount: amount * 1000, unit: 'g' };
    case 'ml':
      return { amount, unit: 'ml' };
    case 'l':
      return { amount: amount * 1000, unit: 'ml' };
    default:
      return { amount, unit };
  }
}

function fromBaseAmount(amount: number, baseUnit: string): { amount: number; unit: string } {
  if (baseUnit === 'g' && amount >= 1000) {
    return { amount: amount / 1000, unit: 'kg' };
  }
  if (baseUnit === 'ml' && amount >= 1000) {
    return { amount: amount / 1000, unit: 'l' };
  }
  return { amount, unit: baseUnit };
}

export function shoppingItemKey(item: ShoppingLineInput): string {
  const unit = normalizeUnit(item.unit) ?? '';
  if (item.ingredientId) {
    return `i:${item.ingredientId}|${unit}`;
  }
  const name = (item.customName ?? '').trim().toLowerCase();
  return `c:${name}|${unit}`;
}

function sameShoppingProduct(a: ShoppingLineInput, b: ShoppingLineInput): boolean {
  if (a.ingredientId && b.ingredientId) {
    return a.ingredientId === b.ingredientId;
  }
  if (!a.ingredientId && !b.ingredientId && a.customName && b.customName) {
    return (
      a.customName.trim().toLowerCase() === b.customName.trim().toLowerCase()
    );
  }
  return false;
}

/**
 * Суммирует количество incoming в existing (оба — строки списка покупок).
 * Возвращает null, если объединять нельзя (разный продукт или несовместимые единицы).
 */
export function mergeShoppingLine(
  existing: ShoppingLineInput,
  incoming: ShoppingLineInput,
): ShoppingLineMerged | null {
  if (!sameShoppingProduct(existing, incoming)) {
    return null;
  }

  const unit = normalizeUnit(existing.unit ?? incoming.unit);

  if (
    isAmountlessUnit(unit) ||
    existing.amount == null ||
    incoming.amount == null
  ) {
    return { amount: existing.amount ?? incoming.amount ?? null, unit: unit ?? null };
  }

  const exNorm = normalizeUnit(existing.unit);
  const inNorm = normalizeUnit(incoming.unit);
  const exBase = exNorm ? toBaseAmount(existing.amount, exNorm) : null;
  const inBase = inNorm ? toBaseAmount(incoming.amount, inNorm) : null;

  if (!exBase || !inBase) {
    return { amount: existing.amount + incoming.amount, unit: unit ?? null };
  }

  if (exBase.unit !== inBase.unit) {
    return null;
  }

  const summed = exBase.amount + inBase.amount;
  const display = fromBaseAmount(summed, exBase.unit);
  return { amount: display.amount, unit: display.unit };
}

/** Как в UI рецепта: labelRu строки рецепта или имя из каталога. */
export function recipeIngredientDisplayName(
  labelRu: string | null | undefined,
  catalogNameRu: string,
): string {
  const label = labelRu?.trim();
  return label || catalogNameRu.trim();
}

/** customName в списке покупок, если подпись в рецепте уточняет каталог. */
export function recipeIngredientShoppingCustomName(
  labelRu: string | null | undefined,
  catalogNameRu: string,
): string | undefined {
  const label = labelRu?.trim();
  if (!label) return undefined;
  const catalog = catalogNameRu.trim();
  if (
    label.localeCompare(catalog, 'ru', { sensitivity: 'base' }) === 0
  ) {
    return undefined;
  }
  return label;
}

/** Один ингредиент в рецепте — одна строка в missing (без дублирования по ingredientId). */
export function dedupeMissingByIngredient(
  missing: MissingIngredient[],
): MissingIngredient[] {
  const seen = new Set<string>();
  const result: MissingIngredient[] = [];
  for (const m of missing) {
    if (seen.has(m.ingredientId)) continue;
    seen.add(m.ingredientId);
    result.push(m);
  }
  return result;
}
