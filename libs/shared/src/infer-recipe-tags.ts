/** Категории блюд в приложении (единый список). */
export const RECIPE_CATEGORY_TAGS = [
  'салаты',
  'закуски',
  'приправы',
  'супы',
  'вторые блюда',
  'каши',
  'блины / оладьи',
  'пироги / пирожки',
  'кексы',
  'печенье',
  'хлеб / лепешки',
  'пицца',
  'торты',
  'напитки',
  'десерты',
  'пп / диетическое',
  'разное',
] as const;

export type RecipeCategoryTag = (typeof RECIPE_CATEGORY_TAGS)[number];

/** Подписи для UI (с учётом «ПП / …», «Блины / …»). */
export const RECIPE_CATEGORY_LABELS: Record<RecipeCategoryTag, string> = {
  'салаты': 'Салаты',
  'закуски': 'Закуски',
  'приправы': 'Приправы',
  'супы': 'Супы',
  'вторые блюда': 'Вторые блюда',
  'каши': 'Каши',
  'блины / оладьи': 'Блины / Оладьи',
  'пироги / пирожки': 'Пироги / Пирожки',
  'кексы': 'Кексы',
  'печенье': 'Печенье',
  'хлеб / лепешки': 'Хлеб / Лепешки',
  'пицца': 'Пицца',
  'торты': 'Торты',
  'напитки': 'Напитки',
  'десерты': 'Десерты',
  'пп / диетическое': 'ПП / Диетическое',
  'разное': 'Разное',
};

const RECIPE_CATEGORY_SET = new Set<string>(RECIPE_CATEGORY_TAGS);

/** Рубрики с iamcook.ru / food.ru → наши категории. */
const SOURCE_RUBRIC_ALIASES: Partial<Record<string, RecipeCategoryTag>> = {
  закуски: 'закуски',
  'вторые блюда': 'вторые блюда',
  'мясные блюда': 'вторые блюда',
  'блюда из картофеля': 'вторые блюда',
  'блюда без мяса': 'вторые блюда',
  'мучные вторые блюда': 'вторые блюда',
  супы: 'супы',
  'супы и бульоны': 'супы',
  'основные блюда': 'вторые блюда',
  салаты: 'салаты',
  'салаты праздничные': 'салаты',
  омлет: 'закуски',
  выпечка: 'хлеб / лепешки',
  'выпечка из слоеного теста': 'пироги / пирожки',
  завтрак: 'закуски',
  круассаны: 'хлеб / лепешки',
};

/** Старые авто-теги (время приёма пищи и т.п.) — не используем как категории. */
const LEGACY_AUTO_TAGS = new Set([
  'первое блюдо',
  'второе блюдо',
  'салат',
  'закуска',
  'вегетарианское',
  'рецепт из теста',
  'гриль',
  'детское',
  'на завтрак',
  'на обед',
  'на ужин',
  'домашнее',
  'домашняя кухня',
]);

export const GENERIC_RECIPE_TAGS = new Set(['домашнее', 'домашняя кухня']);

function normalizeTagText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function isRecipeCategoryTag(tag: string): tag is RecipeCategoryTag {
  return RECIPE_CATEGORY_SET.has(normalizeTagText(tag));
}

type CategoryRule = { tag: RecipeCategoryTag; test: (text: string) => boolean };

function buildRules(): CategoryRule[] {
  const has = (re: RegExp) => (text: string) => re.test(text);
  return [
    { tag: 'салаты', test: has(/салат|винегрет|оливье|цезар|мимоза|столичн|капрезе/i) },
    { tag: 'закуски', test: has(/закуск|канапе|брускет|тарталет|жюльен|хумус|рулетик.*(сыр|ветчин)|tapas/i) },
    {
      tag: 'приправы',
      test: has(/приправ|соус(?!п)|маринад|заправк|аджика|песто|чатни|кetchup|кетчуп/i),
    },
    {
      tag: 'супы',
      test: has(/(^|\s)суп|борщ|окрошк|солянк|гаспачо|крем-суп|суп-пюре|уха/i),
    },
    {
      tag: 'вторые блюда',
      test: has(
        /втор(ое|ые)|основн(ое|ые)|гарнир|котлет|плов|рагу|запеканк|паста|макарон|спагетти|лазань|ризотто|жаркое|тушени|фрикадел|мясо|рыба|куриц|индейк|свинин|говядин|бедра|филе|шницел|бургер|стейк|шашлыч|пельмен/i,
      ),
    },
    { tag: 'каши', test: has(/(^|\s)каш[аи]|овсян|гречк|манн(ая|ой)|перлов|пшен|рисов.*каш/i) },
    {
      tag: 'блины / оладьи',
      test: has(/блин|олад|панкейк|драник|сырник/i),
    },
    {
      tag: 'пироги / пирожки',
      test: has(/пирог|пирож(ок|ки|ков)|ватруш|кулебя|шарлотт|галета|чебурек|самса|эчпочмак/i),
    },
    { tag: 'кексы', test: has(/кекс|маффин|капкейк|muffin|cupcake/i) },
    { tag: 'печенье', test: has(/печень|cookie|бисквит/i) },
    {
      tag: 'хлеб / лепешки',
      test: has(/хлеб|лепеш|булоч|лаваш|багет|фокачч|гриссини|круасс/i),
    },
    { tag: 'пицца', test: has(/pizza|пицц/i) },
    { tag: 'торты', test: has(/(^|\s)торт|наполеон|медовик|pancho/i) },
    {
      tag: 'напитки',
      test: has(/напит|смузи|коктейл|компот|морс|лимонад|глинтвейн|какао|latte|чай|кофе/i),
    },
    {
      tag: 'десерты',
      test: has(
        /десерт|конфет|шоколад|крем-бр|суфле|парфе|мусс|тирамisu|panna|pudding|пудинг|морожен|sorbet|варень|джем|повидл|крисп|charlotte|шарлот|запечен.*яблок|яблок.*запеч|фруктов.*десерт|горяч.*десерт|полдник|сладк.*(косич|булоч|круасс|выпеч)/i,
      ),
    },
    {
      tag: 'пп / диетическое',
      test: has(/пп\b|диет|зож|низкокал|легк.*рецепт|похуд|без сахара|безглют/i),
    },
  ];
}

const CATEGORY_RULES = buildRules();

/** При нескольких рубриках источника — одна основная категория. */
const PRIMARY_CATEGORY_PREFERENCE: RecipeCategoryTag[] = [
  'десерты',
  'торты',
  'кексы',
  'печенье',
  'пироги / пирожки',
  'хлеб / лепешки',
  'салаты',
  'супы',
  'закуски',
  'вторые блюда',
  'каши',
  'блины / оладьи',
  'пицца',
  'напитки',
  'приправы',
  'пп / диетическое',
  'разное',
];

function pickPrimaryCategory(
  candidates: RecipeCategoryTag[],
  title: string,
): RecipeCategoryTag[] {
  if (candidates.length <= 1) return candidates;

  const fromTitle = matchCategoriesFromText(title).filter((t) => t !== 'разное');
  for (const tag of fromTitle) {
    if (candidates.includes(tag)) return [tag];
  }
  for (const tag of PRIMARY_CATEGORY_PREFERENCE) {
    if (candidates.includes(tag)) return [tag];
  }
  return [candidates[0]];
}

function matchCategoriesFromText(...parts: string[]): RecipeCategoryTag[] {
  const text = normalizeTagText(parts.filter(Boolean).join(' '));
  if (!text) return [];

  const matched = new Set<RecipeCategoryTag>();
  for (const rule of CATEGORY_RULES) {
    if (rule.test(text)) matched.add(rule.tag);
  }

  if (matched.has('десерты') && matched.has('вторые блюда')) {
    if (/десерт|полдник|фруктов|запечен.*яблок|горяч.*десерт/i.test(text)) {
      matched.delete('вторые блюда');
    }
  }
  if (matched.has('супы') && matched.has('вторые блюда')) {
    if (/(^|\s)суп|борщ|окрошк|солянк/i.test(text)) {
      matched.delete('вторые блюда');
    }
  }

  const ordered = RECIPE_CATEGORY_TAGS.filter((t) => matched.has(t));
  return ordered.length ? ordered : ['разное'];
}

/**
 * Сопоставляет теги источника и название с нашим списком категорий.
 */
export function mapRecipeCategories(
  title: string,
  sourceTags?: string[] | null,
): RecipeCategoryTag[] {
  const hints = (sourceTags ?? [])
    .map(normalizeTagText)
    .filter((t) => t && !GENERIC_RECIPE_TAGS.has(t) && !LEGACY_AUTO_TAGS.has(t));

  const fromHints = new Set<RecipeCategoryTag>();
  for (const hint of hints) {
    const normalizedHint = normalizeTagText(hint);
    const rubricAlias = SOURCE_RUBRIC_ALIASES[normalizedHint];
    if (rubricAlias) {
      fromHints.add(rubricAlias);
      continue;
    }
    if (isRecipeCategoryTag(normalizedHint)) {
      fromHints.add(normalizedHint);
      continue;
    }
    for (const tag of matchCategoriesFromText(hint, title)) {
      if (tag !== 'разное') fromHints.add(tag);
    }
  }

  if (fromHints.size > 0) {
    const ordered = RECIPE_CATEGORY_TAGS.filter((t) => fromHints.has(t));
    return pickPrimaryCategory(ordered, title);
  }

  return matchCategoriesFromText(title);
}

/** @deprecated Время готовки больше не влияет на категории; оставлено для совместимости с seed-скриптами. */
export function inferRecipeTags(
  title: string,
  sourceTagsOrPrep?: string[] | number | null,
  cookMinutes?: number | null,
): string[] {
  let sourceTags: string[] | null = null;
  if (Array.isArray(sourceTagsOrPrep)) sourceTags = sourceTagsOrPrep;
  return mapRecipeCategories(title, sourceTags);
}

export function normalizeRecipeTags(
  title: string,
  tags: string[] | null | undefined,
  _prepMinutes?: number | null,
  _cookMinutes?: number | null,
): string[] {
  const normalized = (tags ?? []).map(normalizeTagText).filter(Boolean);
  const canonical = normalized.filter(isRecipeCategoryTag) as RecipeCategoryTag[];
  if (canonical.length > 0) {
    return [...new Set(canonical)];
  }

  const legacyHints = normalized.filter((t) => !LEGACY_AUTO_TAGS.has(t));
  const hints = legacyHints.length > 0 ? legacyHints : normalized;
  return mapRecipeCategories(title, hints);
}

export function formatRecipeCategoryLabel(tag: string): string {
  const key = normalizeTagText(tag);
  if (isRecipeCategoryTag(key)) return RECIPE_CATEGORY_LABELS[key];
  if (!key) return tag;
  return key.charAt(0).toUpperCase() + key.slice(1);
}
