import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const {
  catalogEntryMatchesSourceName,
  decodeRecipeTextEntities,
  findCatalogSlugBySourceName,
  ingredientSortedWordKey,
} = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));

export const UA = { 'User-Agent': 'Mozilla/5.0 RecipeManagerSeed/1.0' };

export function loadCatalog(ingredientsPath = join(__dirname, 'ingredients.json')) {
  const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
  return { catalog, slugLookup: buildSlugLookup(catalog) };
}

export function saveCatalog(catalog, ingredientsPath = join(__dirname, 'ingredients.json')) {
  writeFileSync(ingredientsPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
}

function buildSlugLookup(catalog) {
  const map = new Map();
  const add = (phrase, slug) => {
    const key = normalizeTitle(phrase);
    if (key && !map.has(key)) map.set(key, slug);
    const sorted = ingredientSortedWordKey(phrase);
    if (sorted && !map.has(sorted)) map.set(sorted, slug);
  };
  for (const ing of catalog) {
    add(ing.nameRu, ing.slug);
    for (const alias of ing.aliases ?? []) add(alias, ing.slug);
  }
  const extra = {
    'лук репчатый': 'luk',
    'репчатый лук': 'luk',
    'соль и перец': 'sol',
    соль: 'sol',
    'перец черный': 'perets',
    'черный перец': 'perets',
    'перец черный молотый': 'perets',
    помидор: 'pomidor',
    помидоры: 'pomidor',
    'томатная паста': 'krevet-pasta',
    'сметана 20': 'smetana',
    'яйца куриные': 'yaytsa',
    'яйцо куриное': 'yaytsa',
    шампиньоны: 'griby',
    картофель: 'kartofel',
    морковь: 'morkov',
    капуста: 'kapusta',
    'капуста белокочанная': 'kapusta',
    свекла: 'svekla',
    свёкла: 'svekla',
    кabaчок: 'kabachok',
    кабачки: 'kabachok',
    баклажан: 'baklazhan',
    баклажаны: 'baklazhan',
    чеснок: 'chesnok',
    укроп: 'ukrop',
    петрушка: 'petrushka',
    'лимонный сок': 'limon',
    макaronы: 'makaron',
    макароны: 'makaron',
    спагетти: 'makaron',
    рис: 'ris',
    гречка: 'grechka',
    'гречневая крупа': 'grechka',
    'овсяные хлопья': 'ovsyanka',
    тунец: 'tunets',
    'тунец консервированный': 'tunets',
    сельдь: 'seld',
    селедка: 'seld',
    фасоль: 'fasol',
    'фасоль консервированная': 'fasol',
    'фасоль стручковая': 'fasol-struchkovaya',
    чечевица: 'chechevitsa',
    'чечевица красная': 'chechevitsa',
    нут: 'nut',
    тыква: 'tikva',
    брокколи: 'brokkoli',
    имбирь: 'imbir',
    'соевый соус': 'soevyy-sous',
    уксус: 'ukus',
    'сахарный песок': 'sahar',
    сахар: 'sahar',
    мука: 'muka',
    кефир: 'kefir',
    молоко: 'moloko',
    сливки: 'slivki',
    'сыр твердый': 'sir',
    сыр: 'sir',
    творог: 'tvorog',
    майонез: 'mayonez',
    'лавровый лист': 'laurel',
    паприка: 'paprika',
    куркума: 'paprika',
    индейка: 'indiejka',
    'филе индейки': 'indiejka',
    'куриное мясо': 'kuritsa',
    'куриная грудка': 'kuritsa-grudka',
    'куриное филе': 'kuritsa-grudka',
    'куриные крылья': 'kuritsa-krylya',
    'куриные бедра': 'kuritsa-bedro',
    'куриные окорочка': 'kuritsa-okorochka',
    'куриный фарш': 'farsh-kurinyy',
    'филе белой рыбы': 'ryba',
    'устричный соус': 'ustrichesnyy-sous',
    розмарин: 'rozmarin',
    'брюссельская капуста': 'kapusta-bryuss',
    'кукуруза консервированная': 'kukuruza',
    'перец сладкий': 'perets-bolg',
    'сладкий перец': 'perets-bolg',
    'болгарский перец': 'perets-bolg',
    шпинат: 'shpinat',
    сельдерей: 'petrushka',
    'куриное бедро': 'kuritsa-bedro',
    'куриные грудки': 'kuritsa-grudka',
    'филе куриной грудки': 'kuritsa-grudka',
    'масло оливковое': 'maslo-olivkovoe',
    'масло подсолнечное': 'rastmaslo',
    'масло растительное': 'rastmaslo',
    'сливочное масло': 'maslo-sliv',
    'масло сливочное': 'maslo-sliv',
    'сметана 20%': 'smetana',
    'сметана 15%': 'smetana',
    'томатный сок': 'pomidor',
    'зелёный лук': 'luk',
    'зеленый лук': 'luk',
    'красный лук': 'luk',
    'молотый перец': 'perets',
    'перец молотый': 'perets',
    'свинина': 'svinina',
    'говядина': 'govyadina',
    'свиной фарш': 'farsh-svininyy',
    'говяжий фарш': 'farsh-govyazhiy',
    'куриная тушка': 'kuritsa',
    'тушка курицы': 'kuritsa',
    курица: 'kuritsa',
    'куриная ножка': 'kuritsa-okorochka',
    'куриные ножки': 'kuritsa-okorochka',
    'куриные голени': 'kuritsa-okorochka',
    'сахарная пудра': 'sahar',
    'ванильный сugar': 'vanil',
    дрожжи: 'drozhzhi',
    'дрожжи сухие': 'drozhzhi',
    'разрыхлитель': 'drozhzhi',
    'куриный бульон': 'voda',
    'бульон овощной': 'voda',
    'перец красный молотый сладкий': 'paprika',
    'красная рыба': 'ryba',
    'филе рыбы': 'ryba',
    'горошек зелёный': 'goroh',
    'горошек зеленый': 'goroh',
    'горошек консервированный': 'goroh',
    'соль морская': 'sol',
    'перец белый': 'perets',
    'кетчуп': 'ketchup',
    'горчица': 'gorchitsa',
    'бульон': 'voda',
    'сало': 'bekon',
    'сметана': 'smetana',
    'яйцо': 'yaytsa',
    яйца: 'yaytsa',
    'лимон': 'limon',
    'лимоны': 'limon',
    'яблоко': 'yabloko',
    'яблоки': 'yabloko',
    'огурец': 'ogurets',
    'огурцы': 'ogurets',
    'колбаса': 'kolbasa',
    'ветчина': 'kolbasa',
    'бекон': 'bekon',
    'грибы': 'griby',
    'шампиньон': 'griby',
    'свиная грудинка': 'svinina',
    'сало копченое': 'bekon',
    'майоран': 'rozmarin',
    'тимьян': 'rozmarin',
    'базилик': 'bazilik',
    'корица': 'koritsa',
    'кориандр': 'petrushka',
    'мёд': 'med',
    мед: 'med',
    'укроп свежий': 'ukrop',
    'петрушка свежая': 'petrushka',
    'сок лимона': 'limon',
    'растительное масло': 'rastmaslo',
    'оливковое масло': 'maslo-olivkovoe',
    'соль поваренная': 'sol',
    'перец душистый': 'perets',
    'перец горошком': 'perets',
    'перец чёрный горошком': 'perets',
    'перец чёрный': 'perets',
    'перец черный': 'perets',
    'сахар ванильный': 'vanil',
    'ванилин': 'vanil',
    'какао-порошок': 'kakao',
    'шоколад': 'shokolad',
    'орехи': 'orehi',
    'изюм': 'izyum',
    'курага': 'izyum',
    'чернослив': 'izyum',
    'сливки 33%': 'slivki-33',
    'сливки 35%': 'slivki-35',
    'сливки 20%': 'slivki',
    'сливки 10%': 'slivki',
    'сливки жирные': 'slivki',
    'жирные сливки': 'slivki',
    'грецкий орех': 'gretskiy-oreh',
    'орех грецкий': 'gretskiy-oreh',
    'пармезан': 'parmezan',
    'моцарелла': 'mozzarella',
    'фета': 'sir',
    'брынза': 'sir',
    'сулугуни': 'sir',
    'аджика': 'ketchup',
    'хмeli-сuneli': 'paprika',
    'хмели-сунели': 'paprika',
    'карри': 'paprika',
    'куркума': 'paprika',
    'зира': 'paprika',
    'кмин': 'paprika',
    'тмин': 'paprika',
    'кунжут': 'orehi',
    'миндаль': 'orehi',
    'грецкие орехи': 'orehi',
    'кешью': 'orehi',
    'фундук': 'orehi',
    'сгущёнка': 'moloko',
    'сгущенное молоко': 'moloko',
    'сгущённое молоко': 'moloko',
    'коньяк': 'ukus',
    'вино белое': 'ukus',
    'вино красное': 'ukus',
    'лимонная кислота': 'limon',
    'крахмал': 'muka',
    'манная крупа': 'manка',
    'манка': 'manка',
    'перловка': 'perlovka',
    'перловая крупа': 'perlovka',
    'пшено': 'grechka',
    'пшеничная мука': 'muka',
    'крахмал картофельный': 'muka',
    'сода': 'drozhzhi',
    'уксус столовый': 'ukus',
    'уксус 9%': 'ukus',
    'уксус 6%': 'ukus',
    'уксус яблочный': 'ukus',
    'кислота уксусная': 'ukus',
    'кислота лимонная': 'limon',
    'горчица диjonская': 'gorchitsa',
    'горчица дижонская': 'gorchitsa',
    'горчица русская': 'gorchitsa',
    'креветки': 'krevetki',
    'кальмар': 'tunets',
    'кальмары': 'tunets',
    'мидии': 'tunets',
    'осьминог': 'tunets',
    'икра': 'tunets',
    'форель': 'ryba',
    'лосось': 'ryba',
    'семга': 'ryba',
    'сёмга': 'ryba',
    'минтай': 'ryba',
    'треска': 'ryba',
    'скумбрия': 'ryba',
    'сельдь': 'seld',
    'селёдка': 'seld',
    'селедка': 'seld',
    'карп': 'ryba',
    'щука': 'ryba',
    'судак': 'ryba',
    'окунь': 'ryba',
    'камбала': 'ryba',
    'палтус': 'ryba',
    'тиляпия': 'ryba',
    'пangasius': 'ryba',
    'пангasius': 'ryba',
    'пангасиус': 'ryba',
    'тофу': 'tofu',
    'авокадо': 'avokado',
    'банан': 'banan',
    'бананы': 'banan',
    'апельсин': 'apelsin',
    'апельсины': 'apelsin',
    'мандарин': 'apelsin',
    'груша': 'yabloko',
    'груши': 'yabloko',
    'вишня': 'klubnika',
    'черешня': 'klubnika',
    'клубника': 'klubnika',
    'малина': 'malina',
    'смородина': 'malina',
    'клюква': 'malina',
    'облепиха': 'malina',
    'арбуз': 'tikva',
    'дыня': 'tikva',
    'кабачок молодой': 'kabachok',
    'цукини': 'kabachok',
    'редис': 'redis',
    'редька': 'redis',
    'реpa': 'redis',
    'репа': 'redis',
    'сельдерей стебель': 'petrushka',
    'сельderей корень': 'petrushka',
    'пастернак': 'morkov',
    'батат': 'kartofel',
    'батат сладкий': 'kartofel',
    'кукуруза': 'kukuruza',
    'горошек': 'goroh',
    'фасоль стручковая замороженная': 'fasol-struchkovaya',
    'стручковая фасоль': 'fasol-struchkovaya',
    'цветная капуста': 'cauliflower',
    'брокколи замороженная': 'brokkoli',
    'шпинат замороженный': 'shpinat',
    'руккола': 'salat-list',
    'салат': 'salat-list',
    'айсberg': 'salat-list',
    'латук': 'salat-list',
    'кинза': 'petrushka',
    'мята': 'petrushka',
    'эstragon': 'petrushka',
    'эстрагон': 'petrushka',
    'орегано': 'petrushka',
    'marjoram': 'rozmarin',
    'чабер': 'petrushka',
    'кrevet-pasta': 'krevet-pasta',
  };
  for (const [phrase, slug] of Object.entries(extra)) add(phrase, slug);
  return map;
}

export function normalizeTitle(s) {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripHtml(html) {
  return decodeRecipeTextEntities(
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#8594;|&rarr;/gi, ' → ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** Рубрика из хлебных крошек iamcook (#path: Рецепты → Закуски → …). */
export function parseIamcookPathCategories(html) {
  const block = html.match(/id="path"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (!block) return [];

  const parts = stripHtml(block)
    .split(/\s*→\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length < 3) return [];
  if (/^рецепты$/i.test(parts[0])) {
    return parts.slice(1, -1);
  }
  return parts.slice(0, -1);
}

function skipParagraph(text) {
  if (!text) return true;
  if (text.length < 12) return true;
  if (/^(br|photo|фото)$/i.test(text)) return true;
  if (/на фото|фотоотч|автор рецепта|оценить рецепт|реклам/i.test(text)) return true;
  if (/^\d+\s*$/.test(text)) return true;
  return false;
}

export function paraphraseStep(text) {
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

  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function compactSteps(rawParagraphs) {
  const out = [];
  for (const p of rawParagraphs) {
    const line = paraphraseStep(p);
    if (!line || line.length < 20) continue;
    if (out.length && line.length < 40 && out[out.length - 1].length < 120) {
      out[out.length - 1] += ' ' + line;
    } else {
      out.push(line);
    }
  }
  return out.filter((s) => s.length >= 20).slice(0, 28);
}

function normalizeAmountToken(value) {
  return parseFloat(String(value).replace(',', '.'));
}

function formatDualUnit(primaryUnit, weight, weightUnit) {
  const w = Number.isInteger(weight) ? weight : String(weight).replace(/\.?0+$/, '');
  return `${primaryUnit} (${w} ${weightUnit})`;
}

export function cleanIngredientName(nameRu) {
  let n = nameRu.trim().replace(/\s+/g, ' ');
  n = n.replace(/\s+\d+[,.]?\d*\s*(лист|листа|листов|шт\.?)\s*=?\s*$/iu, '');
  n = n.replace(/\s+\d+[,.]?\d*\s*(г|кг|мл|л)\s*=?\s*$/iu, '');
  n = n.replace(/\s+=\s*$/u, '');
  return n.trim() || nameRu.trim();
}

export function parseAmountUnit(raw) {
  let s = raw.trim();
  if (!s) {
    return { amount: null, unit: null, optional: true };
  }
  if (/по вкусу/i.test(s)) {
    return { amount: null, unit: 'по вкусу', optional: false };
  }
  if (/необязательно|желательно/i.test(s)) {
    return { amount: null, unit: null, optional: true };
  }

  const dual = s.match(
    /^([\d.,]+)\s*(шт\.?|ст\.?\s*л\.?|ч\.?\s*л\.?|лист(?:а|ов)?)\s*=\s*([\d.,]+)\s*(г|кг|мл|л)\.?\s*$/i,
  );
  if (dual) {
    const amount = normalizeAmountToken(dual[1]);
    let primary = dual[2].toLowerCase().replace(/\s+/g, ' ').trim();
    if (/^шт/.test(primary)) primary = 'шт';
    else if (/^лист/.test(primary)) primary = 'лист';
    else if (/^ст\.?\s*л/.test(primary)) primary = 'ст. л.';
    else if (/^ч\.?\s*л/.test(primary)) primary = 'ч. л.';
    const weight = normalizeAmountToken(dual[3]);
    const weightUnit = dual[4].toLowerCase();
    return {
      amount,
      unit: formatDualUnit(primary, weight, weightUnit),
      optional: false,
    };
  }

  s = s.replace(',', '.');
  const range = s.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  const amount = range
    ? (parseFloat(range[1]) + parseFloat(range[2])) / 2
    : (() => {
        const m = s.match(/([\d.]+)/);
        return m ? parseFloat(m[1]) : null;
      })();

  const sLower = s.toLowerCase();
  let unit = null;
  if (/кг|kg/.test(sLower)) unit = 'кг';
  else if (/грамм|\d+g\b|[\d.,]+\s*г(?:\s|$|[^a-zа-яё])/i.test(sLower)) unit = 'г';
  else if (/мл|ml/.test(sLower)) unit = 'мл';
  else if (/литр|[\d.,]+\s*л(?:\s|$|[^a-zа-яё])/i.test(sLower)) unit = 'л';
  else if (/шт|штук/.test(sLower)) unit = 'шт';
  else if (/ст\.?\s*л|столов/.test(sLower)) unit = 'ст. л.';
  else if (/ч\.?\s*л|чайн/.test(sLower)) unit = 'ч. л.';
  else if (/лист/.test(sLower)) unit = 'лист';
  else if (/зуб/.test(sLower)) unit = 'зуб.';
  else if (/щепот/.test(sLower)) unit = 'щепотка';
  else if (/банк/.test(sLower)) unit = 'банки';
  else if (/vetoch|веточ/.test(sLower)) unit = 'веточка';
  else if (/пучок|пуч/.test(sLower)) unit = 'пучок';
  else if (/стак/.test(sLower)) unit = 'стак.';
  else if (/порц/.test(sLower)) unit = 'порц.';
  else if (/упаков/.test(sLower)) unit = 'упак.';

  return { amount, unit, optional: false };
}

export function recipeDescriptionFromLd(ld) {
  if (!ld?.description) return undefined;
  const d = stripHtml(String(ld.description)).trim();
  return d.length >= 20 ? d : undefined;
}

export function resolveSlug(nameRu, slugLookup) {
  const n = normalizeTitle(nameRu);
  if (slugLookup.has(n)) return slugLookup.get(n);
  const sorted = ingredientSortedWordKey(nameRu);
  if (sorted && slugLookup.has(sorted)) return slugLookup.get(sorted);

  let best = null;
  let bestLen = 0;
  for (const [key, slug] of slugLookup) {
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

const CYR = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function slugifyRu(nameRu) {
  let s = nameRu.toLowerCase().replace(/ё/g, 'е');
  let out = '';
  for (const ch of s) {
    if (CYR[ch] !== undefined) out += CYR[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/\s|-/.test(ch)) out += '-';
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return out || 'ingredient';
}

function slugAllowedForSourceName(trimmed, slug, catalog) {
  const entry = catalog.find((x) => x.slug === slug);
  if (!entry) return false;
  return catalogEntryMatchesSourceName(entry, trimmed);
}

export function ensureIngredientSlug(nameRu, catalog, slugLookup) {
  const trimmed = cleanIngredientName(nameRu.trim().replace(/\s+/g, ' '));
  const exactKey = normalizeTitle(trimmed);
  const sortedKey = ingredientSortedWordKey(trimmed);

  for (const key of [exactKey, sortedKey]) {
    if (!key || !slugLookup.has(key)) continue;
    const slug = slugLookup.get(key);
    if (slugAllowedForSourceName(trimmed, slug, catalog)) return slug;
  }

  const resolved = resolveSlug(trimmed, slugLookup);
  if (resolved && slugAllowedForSourceName(trimmed, resolved, catalog)) {
    return resolved;
  }

  const fromCatalog = findCatalogSlugBySourceName(trimmed, catalog);
  if (fromCatalog) return fromCatalog;

  let base = slugifyRu(trimmed);
  let slug = base;
  let i = 2;
  while (catalog.some((x) => x.slug === slug)) {
    slug = `${base}-${i}`;
    i++;
  }

  const entry = {
    slug,
    nameRu: trimmed,
    category: 'прочее',
    aliases: [],
  };
  catalog.push(entry);
  slugLookup.set(normalizeTitle(trimmed), slug);
  slugLookup.set(normalizeTitle(entry.nameRu), slug);
  return slug;
}

function splitIngredientLine(line) {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (m) return { name: m[1].trim(), amountPart: m[2].trim() };
  return parseLooseIngredientLine(cleaned);
}

function parseLooseIngredientLine(line) {
  const eq = line.match(
    /^(.+?)\s+([\d.,]+)\s*(шт\.?|ст\.?\s*л\.?|ч\.?\s*л\.?|лист(?:а|ов)?)\s*=\s*([\d.,]+)\s*(г|кг|мл|л)/i,
  );
  if (eq) {
    return {
      name: eq[1].trim(),
      amountPart: `${eq[2]} ${eq[3]} = ${eq[4]} ${eq[5]}`,
    };
  }
  const eqWeight = line.match(/^(.+?)\s*=\s*([\d.,]+)\s*(г|кг|мл|л)\s*$/i);
  if (eqWeight && !/\d+\s*(шт|ст\.?\s*л|ч\.?\s*л|лист)/i.test(eqWeight[1])) {
    return {
      name: eqWeight[1].trim(),
      amountPart: `${eqWeight[2]} ${eqWeight[3]}`,
    };
  }
  const m = line.match(
    /^(.+?)\s+([\d.,]+)\s*(г|кг|мл|л|шт\.?|ст\.?\s*л\.?|ч\.?\s*л\.?|порц\.?|банки?|зуб\.?|щепотка|пучок|стак\.?)\s*$/i,
  );
  if (m) {
    return { name: m[1].trim(), amountPart: `${m[2]} ${m[3] ?? ''}`.trim() };
  }
  if (/по вкусу/i.test(line)) {
    const name = line.replace(/по вкусу/i, '').trim();
    return { name: name || line, amountPart: 'по вкусу' };
  }
  return { name: line, amountPart: '' };
}

function parseIsoDurationMinutes(value) {
  if (!value || typeof value !== 'string') return null;
  const h = value.match(/(\d+)H/i);
  const m = value.match(/(\d+)M/i);
  const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  return total > 0 ? total : null;
}

const JSON_LD_SCRIPT_RE =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function findRecipeJsonLd(html) {
  for (const m of html.matchAll(JSON_LD_SCRIPT_RE)) {
    try {
      const j = JSON.parse(m[1]);
      const type = j['@type'];
      if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
        return j;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Теги/рубрики с сайта-источника (food.ru, iamcook и т.д.). */
export function parseSourceTagsFromHtml(html, sourceUrl) {
  const tags = [];

  if (/food\.ru/i.test(sourceUrl)) {
    const next = html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
    if (next) {
      try {
        const state = JSON.parse(next[1])?.props?.pageProps?.__EFFECTOR_NEXTJS_INITIAL_STATE__;
        if (state && typeof state === 'object') {
          for (const val of Object.values(state)) {
            if (!val || typeof val !== 'object' || !Array.isArray(val.tags)) continue;
            for (const t of val.tags) {
              if (t?.title) tags.push(stripHtml(String(t.title)));
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    const ld = findRecipeJsonLd(html);
    if (ld?.recipeCategory) tags.push(stripHtml(String(ld.recipeCategory)));
  }

  if (/iamcook\.ru/i.test(sourceUrl)) {
    tags.push(...parseIamcookPathCategories(html));
    const ld = findRecipeJsonLd(html);
    const kw = ld?.keywords;
    if (Array.isArray(kw)) tags.push(...kw.map((k) => stripHtml(String(k))));
    else if (kw) tags.push(stripHtml(String(kw)));
  }

  if (/russianfood\.com/i.test(sourceUrl)) {
    for (const m of html.matchAll(/class="[^"]*breadcrumb[^"]*"[\s\S]*?<a[^>]*>([^<]+)</gi)) {
      const t = stripHtml(m[1]);
      if (t && !/главная|рецепты/i.test(t)) tags.push(t);
    }
  }

  if (/edimdoma\.ru/i.test(sourceUrl)) {
    const ld = findRecipeJsonLd(html);
    if (ld?.recipeCategory) {
      const cats = Array.isArray(ld.recipeCategory) ? ld.recipeCategory : [ld.recipeCategory];
      tags.push(...cats.map((c) => stripHtml(String(c))));
    }
    for (const m of html.matchAll(JSON_LD_SCRIPT_RE)) {
      try {
        const j = JSON.parse(m[1]);
        if (j['@type'] !== 'BreadcrumbList' || !Array.isArray(j.itemListElement)) continue;
        for (const el of j.itemListElement) {
          const name = el?.name ?? el?.item?.name;
          if (name) tags.push(stripHtml(String(name)));
        }
      } catch {
        /* ignore */
      }
    }
  }

  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t || t.length > 120) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function extractImageFromLd(ld) {
  if (!ld?.image) return null;
  const img = ld.image;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) {
    const first = img[0];
    return typeof first === 'string' ? first : first?.url ?? null;
  }
  if (typeof img === 'object' && img.url) return img.url;
  return null;
}

function parseIamcookDisplayTimeMinutes(html) {
  const block = html.match(/<li class="time tt"[^>]*>([\s\S]*?)<\/li>/i)?.[1] ?? '';
  const withHours = block.match(/(\d+)\s*ч\.?\s*(\d+)?\s*мин/i);
  if (withHours) {
    const h = Number(withHours[1]);
    const min = withHours[2] ? Number(withHours[2]) : 0;
    return h * 60 + min;
  }
  const onlyMin = block.match(/(\d+)\s*мин/i);
  if (onlyMin) return Number(onlyMin[1]);
  return null;
}

export function resolvePrepCookMinutes({ prep, cook, total }) {
  if (total != null && total > 0) {
    if (prep != null && cook != null) {
      return { prepMinutes: prep, cookMinutes: cook };
    }
    if (cook != null && (prep == null || prep === 0)) {
      return { prepMinutes: prep ?? 0, cookMinutes: cook };
    }
    if (prep != null && (cook == null || cook === 0)) {
      return { prepMinutes: prep, cookMinutes: Math.max(total - prep, 0) };
    }
    const prepMinutes = Math.min(20, total);
    return { prepMinutes, cookMinutes: Math.max(total - prepMinutes, 0) };
  }
  return {
    prepMinutes: prep ?? 15,
    cookMinutes: cook ?? 30,
  };
}

export function parseRecipeMetaFromHtml(html, sourceUrl) {
  const ld = findRecipeJsonLd(html);
  const prep = parseIsoDurationMinutes(ld?.prepTime);
  const cook = parseIsoDurationMinutes(ld?.cookTime);
  const total = parseIsoDurationMinutes(ld?.totalTime);
  let { prepMinutes, cookMinutes } = resolvePrepCookMinutes({ prep, cook, total });

  if (/iamcook\.ru/i.test(sourceUrl)) {
    const legacy = html.match(/class="recipe_time"[\s\S]{0,400}/i)?.[0] ?? html;
    const prepM = legacy.match(/(\d+)\s*мин[^<]{0,40}подгот/i);
    const cookM = legacy.match(/(\d+)\s*мин[^<]{0,40}готов/i);
    if (prepM || cookM) {
      prepMinutes = prepM ? Number(prepM[1]) : prep ?? 15;
      cookMinutes = cookM ? Number(cookM[1]) : cook ?? 30;
    } else if (total == null && cook == null) {
      const display = parseIamcookDisplayTimeMinutes(html);
      if (display != null) {
        prepMinutes = prep ?? 0;
        cookMinutes = display;
      }
    }
  }

  if (/russianfood\.com/i.test(sourceUrl) && total == null && cook == null) {
    const sub = html.match(/class="sub_info"[\s\S]*?<\/div>/i)?.[0] ?? '';
    const hourM = sub.match(/<b>(\d+)<\/b>\s*час/i);
    const activeM = sub.match(/<b>(\d+)<\/b>\s*мин/i);
    if (hourM) cookMinutes = Number(hourM[1]) * 60 + (activeM ? Number(activeM[1]) : 0);
    else if (activeM) cookMinutes = Number(activeM[1]);
  }

  let imageUrl = extractImageFromLd(ld);
  if (!imageUrl) {
    imageUrl =
      html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ??
      html.match(/<meta name="twitter:image" content="([^"]+)"/i)?.[1] ??
      null;
  }

  return { prepMinutes, cookMinutes, imageUrl };
}

export function mapIngredientLines(lines, catalog, slugLookup) {
  const items = [];
  for (const line of lines) {
    if (!line || line.length < 2) continue;
    const { name, amountPart } = splitIngredientLine(line);
    let { amount, unit, optional } = parseAmountUnit(amountPart || 'по вкусу');
    if (amount != null && unit == null && !optional && amount > 0 && amount <= 10) {
      unit = 'шт';
    }
    const label = cleanIngredientName(name.trim().replace(/\s+/g, ' '));
    const slug = ensureIngredientSlug(label, catalog, slugLookup);
    items.push({
      slug,
      nameRu: label,
      amount,
      unit,
      optional: optional ?? false,
    });
  }
  return items;
}

export function parseIamcook(html, catalog, slugLookup) {
  const title =
    stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '') ||
    stripHtml(html.match(/<title>([^<]+)/i)?.[1] ?? '').replace(/,?\s*рецепт.*$/i, '');

  const block = html.match(/<div class="ingredients">([\s\S]*?)<\/div>/);
  const ingLines = [];
  if (block) {
    for (const m of block[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const inner = m[1];
      const link = inner.match(/class="ingrlistclick"[^>]*>([^<]+)</i);
      const name = link ? stripHtml(link[1]) : stripHtml(inner.split(' - ')[0]);
      const plain = stripHtml(inner);
      const splitMatch = plain.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      const dashPart = splitMatch ? splitMatch[2] : plain.replace(name, '').trim();
      if (name) ingLines.push(dashPart ? `${name} - ${dashPart}` : name);
    }
  }

  const instr = html.match(/<div class="instructions">([\s\S]*?)<\/div>\s*(?:<\/div>|<hr)/);
  let rawSteps = [];
  if (instr) {
    rawSteps = [...instr[1].matchAll(/<p>([\s\S]*?)<\/p>/g)]
      .map((m) => stripHtml(m[1]))
      .filter((t) => !skipParagraph(t));
    if (rawSteps.length < 2) {
      rawSteps = instr[1]
        .split(/<br\s*\/?>/gi)
        .map((chunk) => stripHtml(chunk))
        .filter((t) => !skipParagraph(t));
    }
  }

  const steps = compactSteps(rawSteps);
  const ingredients = mapIngredientLines(ingLines, catalog, slugLookup);

  let servings = 4;
  const servM = html.match(/(\d+)\s*порц/i);
  if (servM) servings = Number(servM[1]);

  const meta = parseRecipeMetaFromHtml(html, 'https://www.iamcook.ru/');
  const description = recipeDescriptionFromLd(findRecipeJsonLd(html));

  return {
    title,
    description,
    ingredients,
    steps,
    prepMinutes: meta.prepMinutes,
    cookMinutes: meta.cookMinutes,
    servings,
    imageUrl: meta.imageUrl,
  };
}

export function parseFoodRu(html, catalog, slugLookup, sourceUrl) {
  let ld = null;
  for (const m of html.matchAll(JSON_LD_SCRIPT_RE)) {
    try {
      const j = JSON.parse(m[1]);
      const type = j['@type'];
      if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
        ld = j;
        break;
      }
    } catch {
      /* ignore */
    }
  }
  if (!ld) throw new Error('Recipe JSON-LD not found');

  const canonical =
    html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] ??
    ld.url ??
    sourceUrl;

  const title = stripHtml(ld.name ?? '');
  const ingLines = (ld.recipeIngredient ?? []).map((x) => stripHtml(String(x)));
  const ingredients = mapIngredientLines(ingLines, catalog, slugLookup);

  const rawSteps = [];
  for (const step of ld.recipeInstructions ?? []) {
    if (typeof step === 'string') rawSteps.push(stripHtml(step));
    else if (step?.text) rawSteps.push(stripHtml(step.text));
  }
  const steps = compactSteps(rawSteps);

  const total = parseIsoDurationMinutes(ld.totalTime);
  const cook = parseIsoDurationMinutes(ld.cookTime);
  const prep = parseIsoDurationMinutes(ld.prepTime);
  const { prepMinutes, cookMinutes } = resolvePrepCookMinutes({ prep, cook, total });

  let servings = 4;
  const yieldRaw = ld.recipeYield;
  const yieldStr = Array.isArray(yieldRaw) ? yieldRaw[0] : yieldRaw;
  if (yieldStr) {
    const n = String(yieldStr).match(/(\d+)/);
    if (n) servings = Number(n[1]);
  }

  return {
    title,
    description: recipeDescriptionFromLd(ld),
    ingredients,
    steps,
    prepMinutes,
    cookMinutes,
    servings,
    canonicalUrl: canonical,
    imageUrl: extractImageFromLd(ld),
  };
}

export function parseRussianfood(html, catalog, slugLookup) {
  const title = stripHtml(html.match(/<h1 class="title[^"]*">([\s\S]*?)<\/h1>/i)?.[1] ?? '');

  const ingLines = [];
  for (const m of html.matchAll(
    /<tr class="ingr_tr_\d+">\s*<td[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/gi,
  )) {
    const line = stripHtml(m[1]).trim();
    if (line && !/^ингредиент/i.test(line)) ingLines.push(line);
  }

  const rawSteps = [];
  for (const m of html.matchAll(/<div class="step_n">[\s\S]*?<p>([\s\S]*?)<\/p>/gi)) {
    const t = stripHtml(m[1]).trim();
    if (t) rawSteps.push(t);
  }

  const steps = compactSteps(rawSteps);
  const ingredients = mapIngredientLines(ingLines, catalog, slugLookup);

  let servings = 4;
  const sub = html.match(/class="sub_info"[\s\S]*?<\/div>/i)?.[0] ?? '';
  const servM = sub.match(/<b>(\d+)<\/b>\s*<\/span>\s*порц/i) ?? html.match(/<b>(\d+)<\/b>[^<]{0,20}порц/i);
  if (servM) servings = Number(servM[1]);

  const meta = parseRecipeMetaFromHtml(html, 'https://www.russianfood.com/');

  return {
    title,
    description: recipeDescriptionFromLd(findRecipeJsonLd(html)),
    ingredients,
    steps,
    prepMinutes: meta.prepMinutes,
    cookMinutes: meta.cookMinutes,
    servings,
    imageUrl: meta.imageUrl,
  };
}

export async function fetchHtml(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (/russianfood\.com/i.test(url)) {
    try {
      return new TextDecoder('windows-1251').decode(buf);
    } catch {
      return buf.toString('utf8');
    }
  }
  return buf.toString('utf8');
}

export function detectParser(url) {
  if (/iamcook\.ru/i.test(url)) return 'iamcook';
  if (/russianfood\.com/i.test(url)) return 'russianfood';
  if (/food\.ru/i.test(url)) return 'foodru';
  if (/edimdoma\.ru/i.test(url)) return 'edimdoma';
  return null;
}

export function parseRecipeFromHtml(html, sourceUrl, catalog, slugLookup) {
  const kind = detectParser(sourceUrl);
  if (kind === 'iamcook') return { ...parseIamcook(html, catalog, slugLookup), canonicalUrl: sourceUrl };
  if (kind === 'russianfood') return { ...parseRussianfood(html, catalog, slugLookup), canonicalUrl: sourceUrl };
  if (kind === 'foodru') return parseFoodRu(html, catalog, slugLookup, sourceUrl);
  if (kind === 'edimdoma') return parseFoodRu(html, catalog, slugLookup, sourceUrl);
  throw new Error(`Unsupported source: ${sourceUrl}`);
}

export function normalizeSourceUrl(url) {
  try {
    const u = new URL(url);
    if (/russianfood\.com/i.test(u.hostname)) {
      const rid = u.searchParams.get('rid');
      if (rid) return `https://www.russianfood.com/recipes/recipe.php?rid=${rid}`;
    }
    if (/iamcook\.ru/i.test(u.hostname)) {
      const m = u.pathname.match(/showrecipe\/(\d+)/);
      if (m) return `https://www.iamcook.ru/showrecipe/${m[1]}`;
    }
    if (/food\.ru/i.test(u.hostname)) {
      u.hostname = 'food.ru';
      u.protocol = 'https:';
    }
    if (/edimdoma\.ru/i.test(u.hostname)) {
      const idMatch = u.pathname.match(/\/retsepty\/(\d+)(?:-|$|\/)/);
      if (idMatch) return `https://www.edimdoma.ru/retsepty/${idMatch[1]}`;
    }
    u.hash = '';
    return u.toString();
  } catch {
    return url.trim();
  }
}
