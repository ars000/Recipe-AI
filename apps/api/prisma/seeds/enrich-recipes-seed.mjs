/**
 * Обогащает recipes.seed.json: ссылки iamcook, шаги (пересказ), ингредиенты с оригинала.
 * Запуск: node apps/api/prisma/seeds/enrich-recipes-seed.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, 'recipes.seed.json');
const sourcesPath = join(__dirname, 'recipe-sources.json');
const ingredientsPath = join(__dirname, 'ingredients.json');

const UNIT_RU = {
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

const SOURCE_MAP = JSON.parse(readFileSync(sourcesPath, 'utf8'));
const INGREDIENTS_CATALOG = JSON.parse(readFileSync(ingredientsPath, 'utf8'));

const SLUG_LOOKUP = buildSlugLookup(INGREDIENTS_CATALOG);

function buildSlugLookup(catalog) {
  const map = new Map();
  const add = (phrase, slug) => {
    const key = normalizeTitle(phrase);
    if (key && !map.has(key)) map.set(key, slug);
  };
  for (const ing of catalog) {
    add(ing.nameRu, ing.slug);
    for (const alias of ing.aliases ?? []) add(alias, ing.slug);
  }
  const extra = {
    'лук репчатый': 'luk',
    'репчатый лук': 'luk',
    'соль и перец': 'sol',
    'соль': 'sol',
    'перец черный': 'perets',
    'черный перец': 'perets',
    'помидор': 'pomidor',
    'помидоры': 'pomidor',
    'томатная паста': 'krevet-pasta',
    'сметана 20': 'smetana',
    'яйца куриные': 'yaytsa',
    'яйцо куриное': 'yaytsa',
    'шампиньоны': 'griby',
    'картофель': 'kartofel',
    'морковь': 'morkov',
    'капуста': 'kapusta',
    'свекла': 'svekla',
    'свёкла': 'svekla',
    'кабачок': 'kabachok',
    'кабачки': 'kabachok',
    'баклажан': 'baklazhan',
    'баклажаны': 'baklazhan',
    'чеснок': 'chesnok',
    'укроп': 'ukrop',
    'петрушка': 'petrushka',
    'лимонный сок': 'limon',
    'вода': 'voda',
    'макaronы': 'makaron',
    'макароны': 'makaron',
    'спагетти': 'makaron',
    'рис': 'ris',
    'гречка': 'grechka',
    'гречневая крупа': 'grechka',
    'овсяные хлопья': 'ovsyanka',
    'тунец': 'tunets',
    'тунец консервированный': 'tunets',
    'сельдь': 'seld',
    'селедка': 'seld',
    'фасоль': 'fasol',
    'фасоль консервированная': 'fasol',
    'чечевица': 'chechevitsa',
    'чечевица красная': 'chechevitsa',
    'нут': 'nut',
    'тыква': 'tikva',
    'брокколи': 'brokkoli',
    'имбирь': 'imbir',
    'соевый соус': 'soevyy-sous',
    'уксус': 'ukus',
    'сахарный песок': 'sahar',
    'сахар': 'sahar',
    'мука': 'muka',
    'кефир': 'kefir',
    'молоко': 'moloko',
    'сливки': 'slivki',
    'сыр твердый': 'sir',
    'сыр': 'sir',
    'творог': 'tvorog',
    'майонез': 'mayonez',
    'лавровый лист': 'laurel',
    'паприка': 'paprika',
    'куркума': 'paprika',
    'индейка': 'indiejka',
    'филе индейки': 'indiejka',
    'куриное мясо': 'kuritsa',
    'куриная грудка': 'kuritsa',
    'огурец': 'ogurets',
    'огурцы': 'ogurets',
    'огурцы соленые': 'ogurets',
    'огурцы маринованные': 'ogurets',
    'зелень': 'petrushka',
    'салат': 'salat-list',
    'руккола': 'salat-list',
    'масло оливковое': 'maslo-oliv',
    'масло подсолнечное': 'rastmaslo',
    'филе белой рыбы': 'ryba',
    'устричный соус': 'ustrichesnyy-sous',
    'розмарин': 'rozmarin',
    'брюссельская капуста': 'kapusta-bryuss',
    'фасоль стручковая': 'fasol-struchkovaya',
    'перец черный молотый': 'perets',
    'кукуруза консервированная': 'kukuruza',
    'куриное бедро': 'kuritsa',
    'куриные грудки': 'kuritsa',
    'филе куриной грудки': 'kuritsa',
    'перец сладкий': 'perets-bolg',
    'сладкий перец': 'perets-bolg',
    'шпинат': 'shpinat',
    'сельдерей': 'petrushka',
    'разрыхлитель': 'drozhzhi',
    'куриный бульон': 'voda',
    'бульон овощной': 'voda',
    'перец красный молотый сладкий': 'paprika',
  };
  for (const [phrase, slug] of Object.entries(extra)) add(phrase, slug);
  return map;
}

function baseTitle(title) {
  return title.replace(/\s+вариант\s+\d+$/i, '').trim();
}

function normalizeTitle(s) {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function skipParagraph(text) {
  if (!text) return true;
  if (text.length < 12) return true;
  if (/^(br|photo|фото)$/i.test(text)) return true;
  if (/на фото|фотоотч|автор рецепта|оценить рецепт/i.test(text)) return true;
  if (/^\d+\s*$/.test(text)) return true;
  return false;
}

function paraphraseStep(text, variantIndex) {
  let t = text.trim();
  if (skipParagraph(t)) return null;

  t = t
    .replace(/\bя\b/gi, 'вы')
    .replace(/\bмне\b/gi, 'вам')
    .replace(/\bу меня\b/gi, 'в вашем случае')
    .replace(/по моему рецепту/gi, 'в этом варианте')
    .replace(/как на фото/gi, '')
    .replace(/смотрите на фото/gi, '');

  const swaps = [
    [/^подготовьте ингредиенты/i, 'Сначала разложите продукты и подготовьте посуду'],
    [/помойте/gi, 'промойте'],
    [/выложите/gi, 'переложите'],
    [/перемешайте/gi, 'аккуратно перемешайте'],
    [/накройте сковороду крышкой/gi, 'накрывайте крышкой'],
    [/готово\.?$/i, 'Блюдо готово — можно подавать.'],
  ];
  for (const [re, rep] of swaps) {
    t = t.replace(re, rep);
  }

  if (variantIndex === 2) {
    t = t.replace(/\.$/, '') + ' (при желании скорректируйте специи).';
  }

  return t.charAt(0).toUpperCase() + t.slice(1);
}

function compactSteps(rawParagraphs, variantIndex) {
  const out = [];
  for (const p of rawParagraphs) {
    const line = paraphraseStep(p, variantIndex);
    if (!line || line.length < 20) continue;
    if (out.length && line.length < 40 && out[out.length - 1].length < 120) {
      out[out.length - 1] += ' ' + line;
    } else {
      out.push(line);
    }
  }
  return out.filter((s) => s.length >= 20).slice(0, 24);
}

function parseAmountUnit(raw) {
  let s = raw.trim().toLowerCase();
  if (!s) {
    return { amount: null, unit: null, optional: true };
  }
  if (/по вкусу/i.test(s)) {
    return { amount: null, unit: 'по вкусу', optional: false };
  }
  if (/необязательно|желательно/i.test(s)) {
    return { amount: null, unit: null, optional: true };
  }
  s = s.replace(',', '.');
  const range = s.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  const amount = range
    ? (parseFloat(range[1]) + parseFloat(range[2])) / 2
    : (() => {
        const m = s.match(/([\d.]+)/);
        return m ? parseFloat(m[1]) : null;
      })();

  let unit = null;
  if (/кг|kg/.test(s)) unit = 'кг';
  else if (/грамм|\d+g\b|[\d.,]+\s*г(?:\s|$|[^a-zа-яё])/i.test(s)) unit = 'г';
  else if (/мл|ml/.test(s)) unit = 'мл';
  else if (/литр|[\d.,]+\s*л(?:\s|$|[^a-zа-яё])/i.test(s)) unit = 'л';
  else if (/шт|штук/.test(s)) unit = 'шт';
  else if (/ст\.?\s*л|столов/.test(s)) unit = 'ст. л.';
  else if (/ч\.?\s*л|чайн/.test(s)) unit = 'ч. л.';
  else if (/зуб/.test(s)) unit = 'зуб.';
  else if (/щепот/.test(s)) unit = 'щепотка';
  else if (/банк/.test(s)) unit = 'банки';
  else if (/веточ/.test(s)) unit = 'веточка';

  return { amount, unit, optional: false };
}

function resolveSlug(nameRu) {
  const n = normalizeTitle(nameRu);
  if (SLUG_LOOKUP.has(n)) return SLUG_LOOKUP.get(n);

  let best = null;
  let bestLen = 0;
  for (const [key, slug] of SLUG_LOOKUP) {
    if (key.length < 3) continue;
    if (n.includes(key) || key.includes(n)) {
      if (key.length > bestLen) {
        bestLen = key.length;
        best = slug;
      }
    }
  }
  return best;
}

function parseIngredientsFromHtml(html) {
  const block = html.match(/<div class="ingredients">([\s\S]*?)<\/div>/);
  if (!block) return [];

  const items = [];
  for (const m of block[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const inner = m[1];
    const link = inner.match(/class="ingrlistclick"[^>]*>([^<]+)</i);
    const name = link ? stripHtml(link[1]) : stripHtml(inner.split(' - ')[0]);
    if (!name || name.length < 2) continue;

    const plain = stripHtml(inner);
    const splitMatch = plain.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    const dashPart = splitMatch ? splitMatch[2] : plain.replace(name, '').trim();

    const { amount, unit, optional } = parseAmountUnit(dashPart);
    const slug = resolveSlug(name);
    if (!slug) {
      console.warn(`    ? не сопоставлен: ${name}`);
      continue;
    }
    items.push({ slug, amount, unit, optional: optional ?? false });
  }
  return items;
}

async function fetchPageHtml(sourceUrl) {
  const res = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'RecipeManagerSeed/1.0' },
  });
  return res.text();
}

function extractInstructionTexts(blockHtml) {
  const fromP = [...blockHtml.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) => stripHtml(m[1]))
    .filter((t) => !skipParagraph(t));
  if (fromP.length >= 2) return fromP;

  return blockHtml
    .split(/<br\s*\/?>/gi)
    .map((chunk) => stripHtml(chunk))
    .filter((t) => !skipParagraph(t));
}

function fetchStepsFromHtml(html, variantIndex) {
  const block = html.match(
    /<div class="instructions">([\s\S]*?)<\/div>\s*(?:<\/div>|<hr)/,
  );
  if (!block) return [];
  return compactSteps(extractInstructionTexts(block[1]), variantIndex);
}

function variantNumber(title) {
  const m = title.match(/вариант\s+(\d+)$/i);
  return m ? Number(m[1]) : 1;
}

async function main() {
  const recipes = JSON.parse(readFileSync(seedPath, 'utf8'));

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const key = baseTitle(recipe.title);
    const sourceUrl = SOURCE_MAP[key];
    const vNum = variantNumber(recipe.title);

    process.stdout.write(`[${i + 1}/${recipes.length}] ${recipe.title}… `);

    if (!sourceUrl) {
      console.log('нет URL');
      continue;
    }

    recipe.sourceUrl = sourceUrl;

    try {
      const { loadCatalog, parseRecipeFromHtml, fetchHtml } = await import(
        './recipe-import-lib.mjs'
      );
      const { catalog, slugLookup } = loadCatalog();
      const html = await fetchHtml(sourceUrl);
      const parsed = parseRecipeFromHtml(html, sourceUrl, catalog, slugLookup);
      if (parsed.description) recipe.description = parsed.description;
      if (parsed.steps?.length >= 2) recipe.steps = parsed.steps;
      if (parsed.ingredients?.length >= 2) recipe.ingredients = parsed.ingredients;
      else console.log(`ингредиентов мало (${parsed.ingredients?.length ?? 0}),`);
    } catch (e) {
      console.log('ошибка', e.message);
    }

    console.log('ok');
    await new Promise((r) => setTimeout(r, 350));
  }

  writeFileSync(seedPath, JSON.stringify(recipes, null, 2) + '\n', 'utf8');
  console.log('Written', seedPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
