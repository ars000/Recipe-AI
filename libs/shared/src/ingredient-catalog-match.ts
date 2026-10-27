/** Нормализация названия для сопоставления с каталогом (регистр, ё, пунктуация). */
export function normalizeIngredientTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ключ без учёта порядка слов: «грецкий орех» = «орех грецкий». */
export function ingredientSortedWordKey(value: string): string {
  const normalized = normalizeIngredientTitle(value);
  if (!normalized) return '';
  return normalized.split(' ').filter(Boolean).sort().join(' ');
}

export function ingredientNamesEquivalent(a: string, b: string): boolean {
  const left = normalizeIngredientTitle(a);
  const right = normalizeIngredientTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return ingredientSortedWordKey(a) === ingredientSortedWordKey(b);
}

export type CatalogIngredientRef = {
  slug: string;
  nameRu: string;
  aliases?: string[];
  category?: string | null;
};

/** Сливки из рецепта → slug в каталоге (35%/33% или общие «Сливки»). */
export function resolveSlivkiCatalogSlug(
  nameRu: string,
  catalog: CatalogIngredientRef[],
): string | null {
  const n = normalizeIngredientTitle(nameRu);
  if (!n.includes('сливк')) return null;
  if (n.includes('кокос')) {
    const coconut = catalog.find((x) => x.slug === 'kokosovye-slivki');
    return coconut?.slug ?? null;
  }

  const pctMatch = nameRu.match(/(\d{1,2})\s*%/);
  if (pctMatch) {
    const pct = pctMatch[1];
    const byPct = catalog.find((x) => x.slug === `slivki-${pct}`);
    if (byPct) return byPct.slug;
  }

  if (n.includes('жирн') || n === 'сливки' || /\d+\s*%/.test(nameRu)) {
    if (catalog.some((x) => x.slug === 'slivki')) return 'slivki';
  }

  if (catalog.some((x) => x.slug === 'slivki')) return 'slivki';
  return null;
}

export function catalogEntryMatchesSourceName(
  entry: CatalogIngredientRef,
  sourceName: string,
): boolean {
  const trimmed = sourceName.trim();
  if (!trimmed) return false;
  if (ingredientNamesEquivalent(entry.nameRu, trimmed)) return true;
  for (const alias of entry.aliases ?? []) {
    if (ingredientNamesEquivalent(alias, trimmed)) return true;
  }
  return false;
}

export function findCatalogSlugBySourceName(
  sourceName: string,
  catalog: CatalogIngredientRef[],
): string | null {
  const trimmed = sourceName.trim();
  if (!trimmed) return null;

  const cream = resolveSlivkiCatalogSlug(trimmed, catalog);
  if (cream) return cream;

  for (const entry of catalog) {
    if (catalogEntryMatchesSourceName(entry, trimmed)) return entry.slug;
  }
  return null;
}

export type CatalogMatchSuggestion = {
  slug: string;
  score: number;
};

function normalizedWords(text: string): string[] {
  return normalizeIngredientTitle(text).split(' ').filter(Boolean);
}

/** Совпадение по целому слову (не подстрока: «сок» ≠ «песок», «кусок»). */
function hayContainsSourceWord(hay: string, word: string): boolean {
  const w = normalizeIngredientTitle(word);
  if (!w) return false;
  const tokens = normalizedWords(hay);
  return tokens.some((token) => token === w);
}

function isPreservedInOwnJuiceName(nameRu: string): boolean {
  return /в собственном соку|в соке/i.test(nameRu);
}

function isJuiceProductName(nameRu: string): boolean {
  const n = normalizeIngredientTitle(nameRu);
  return n.startsWith('сок ') || n.endsWith(' сок') || n.includes(' сок ');
}

/** Предпочтительные категории каталога для коротких названий с фото. */
export function inferPreferredCategories(sourceName: string): string[] {
  const n = normalizeIngredientTitle(sourceName);
  if (!n) return [];
  if (n === 'перец' || n.startsWith('перец ')) return ['овощи', 'бакалея'];
  if (n === 'сок' || n.startsWith('сок ') || n.endsWith(' сок') || n.includes(' сок ')) {
    return ['прочее', 'бакалея'];
  }
  return [];
}

function applyCategoryAndHeuristicBoosts(
  entry: CatalogIngredientRef,
  sourceName: string,
  baseScore: number,
): number {
  if (baseScore <= 0) return 0;

  let score = baseScore;
  const normSource = normalizeIngredientTitle(sourceName.trim());
  const normName = normalizeIngredientTitle(entry.nameRu);
  const cat = (entry.category ?? '').toLowerCase();

  if (normSource === 'сок') {
    if (isPreservedInOwnJuiceName(entry.nameRu)) return 0;
    if (isJuiceProductName(entry.nameRu)) score += 35;
    if (cat === 'мясо' || cat === 'рыба') score -= 40;
  }

  if (normSource === 'перец') {
    if (/болгарск/.test(normName)) score += 40;
    if (cat === 'овощи' && normName.startsWith('перец ')) score += 25;
    if (/молот|хлоп|душист|черн|белый|острый|чил|жгуч/.test(normName) && !/болгарск/.test(normName)) {
      score -= 35;
    }
  }

  const preferred = inferPreferredCategories(sourceName);
  if (preferred.length && cat) {
    const idx = preferred.indexOf(cat);
    if (idx === 0) score += 22;
    else if (idx > 0) score += 8;
    else score -= 18;
  }

  if (normName.startsWith(`${normSource} `) || normName === normSource) {
    score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

/** Оценка похожести названия модели на позицию каталога (0 — нет совпадения). */
export function scoreCatalogEntryForSourceName(
  entry: CatalogIngredientRef,
  sourceName: string,
): number {
  const trimmed = sourceName.trim();
  if (!trimmed) return 0;
  if (catalogEntryMatchesSourceName(entry, trimmed)) return 100;

  const normSource = normalizeIngredientTitle(trimmed);
  const normName = normalizeIngredientTitle(entry.nameRu);
  const sourceWords = normSource.split(' ').filter((w) => w.length >= 2);
  if (!sourceWords.length) return 0;

  if (normSource.length >= 4 && normName.length >= 4) {
    if (hayContainsSourceWord(normName, normSource) || hayContainsSourceWord(normSource, normName)) {
      const minLen = Math.min(normName.length, normSource.length);
      const maxLen = Math.max(normName.length, normSource.length);
      return applyCategoryAndHeuristicBoosts(
        entry,
        sourceName,
        45 + Math.round((minLen / maxLen) * 25),
      );
    }
  }

  const hayParts = [entry.nameRu, ...(entry.aliases ?? [])];
  let best = 0;
  for (const part of hayParts) {
    let matched = 0;
    for (const w of sourceWords) {
      if (hayContainsSourceWord(part, w)) matched++;
    }
    if (matched > 0) {
      best = Math.max(best, Math.round((matched / sourceWords.length) * 40));
    }
  }

  return applyCategoryAndHeuristicBoosts(entry, sourceName, best);
}

/** Кандидаты каталога, если точного совпадения нет (для ручного подтверждения). */
export function suggestCatalogSlugsForSourceName(
  sourceName: string,
  catalog: CatalogIngredientRef[],
  limit = 8,
  minScore = 8,
): CatalogMatchSuggestion[] {
  const exact = findCatalogSlugBySourceName(sourceName, catalog);
  if (exact) return [{ slug: exact, score: 100 }];

  const preferred = inferPreferredCategories(sourceName);
  const scored = catalog
    .map((entry) => ({
      slug: entry.slug,
      score: scoreCatalogEntryForSourceName(entry, sourceName),
      category: (entry.category ?? '').toLowerCase(),
    }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aPref = preferred.indexOf(a.category);
      const bPref = preferred.indexOf(b.category);
      const aRank = aPref === -1 ? 99 : aPref;
      const bRank = bPref === -1 ? 99 : bPref;
      if (aRank !== bRank) return aRank - bRank;
      return a.slug.localeCompare(b.slug);
    });

  const seen = new Set<string>();
  const out: CatalogMatchSuggestion[] = [];
  for (const row of scored) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function decodeNumericEntity(code: string): string {
  const value = code.startsWith('x') || code.startsWith('X')
    ? parseInt(code.slice(1), 16)
    : parseInt(code, 10);
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
    return code;
  }
  try {
    return String.fromCodePoint(value);
  } catch {
    return code;
  }
}

export function decodeRecipeTextEntities(text: string): string {
  let s = text;
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, hex) => decodeNumericEntity(`x${hex}`));
  s = s.replace(/&#(\d+);/g, (_, dec) => decodeNumericEntity(dec));
  s = s
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&ldquo;/gi, '«')
    .replace(/&rdquo;/gi, '»')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&minus;/gi, '−')
    .replace(/&hellip;/gi, '…')
    .replace(/&deg;/gi, '°')
    .replace(/&ordm;/gi, '°')
    .replace(/&trade;/gi, '™')
    .replace(/&shy;/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&amp;/gi, '&');
  return s;
}
