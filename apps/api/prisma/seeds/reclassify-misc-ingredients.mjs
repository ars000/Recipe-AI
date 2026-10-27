/**
 * Перенос и слияние продуктов из «Прочее» по правилам каталога.
 * node apps/api/prisma/seeds/reclassify-misc-ingredients.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ingredientsPath = join(__dirname, 'ingredients.json');
const recipesPath = join(__dirname, 'recipes.seed.json');

/** @param {string} phrase */
function aliasKey(phrase) {
  return phrase.toLowerCase().trim();
}

/**
 * @param {Array<{ slug: string; nameRu: string; category: string; aliases: string[] }>} catalog
 * @param {string} targetSlug
 * @param {string} phrase
 */
function addAlias(catalog, targetSlug, phrase) {
  const ing = catalog.find((x) => x.slug === targetSlug);
  if (!ing || !phrase) return;
  const key = aliasKey(phrase);
  const existing = new Set((ing.aliases ?? []).map(aliasKey));
  if (key === aliasKey(ing.nameRu) || existing.has(key)) return;
  ing.aliases = [...(ing.aliases ?? []), phrase];
}

/** slug → canonical slug (удаляется из каталога) */
const MERGE_SLUGS = {
  'moskovskiy-provansal-ot-brenda-ya-lyublyu-gotovi': 'mayonez',
  'rebra-svinye': 'svinye-rebra',
  'svinye-rebryshki': 'svinye-rebra',
  'bolgarskiy-krasnyy-perets': 'perets-bolg',
  'malenkiy-puchok-petrushki': 'petrushka',
  'nebolshoy-puchok-petrushki': 'petrushka',
  'malenkiy-puchok-kinzy': 'kinza',
  'nebolshoy-puchok-kinzy': 'kinza',
  'zerna-granata-po-zhelaniyu': 'granat',
  'granatnye-zerna': 'granat',
  'goroh-kolotyy': 'goroh-suhoy',
  'mash-tm-natsional': 'mash',
  'morskie-grebeshki-tm-maguro': 'morskie-grebeshki',
  'molotyy-muskatnyy-oreh': 'muskatnyy-oreh-1-schepotka',
  'muskatnyy-oreh-molotyy': 'muskatnyy-oreh-1-schepotka',
  'oreh-muskatnyy': 'muskatnyy-oreh-1-schepotka',
  'molotyy-krasnyy-perets': 'perets-krasnyy-molotyy',
  'smes-neskolkih-vidov-pertsa': 'smes-pertsev',
  'nebolshoy-koren-imbirya': 'imbir',
  'perets-zhguchiy': 'perets-krasnyy-zhguchiy',
  'perets-krasnyy-ostryy': 'perets-ostryy',
  'perets-ostryy-zelenyy': 'perets-ostryy',
  'perets-chili': 'perets-ostryy',
  'krolik-zadnyaya-chast': 'krolik',
  'nebolshoy-tsyplenok': 'tsyplenok',
  'tushka-tsyplenka': 'tsyplenok-tushka',
  'tsyplyata-tushki': 'tsyplenok-tushka',
  'shafran-imeretinskiy': 'shafran-1-st-l',
  'myasnoy-farsh': 'farsh-smeshannyy',
  'farsh-myasnoy': 'farsh-smeshannyy',
  'poroshok-chesnochnyy': 'chesnochnyy-poroshok',
  'laym-2-dolka': 'laym-1-sht',
  'laym-po-zhelaniyu': 'laym-1-sht',
  'laym-05-sht': 'laym-1-sht',
};

const DELETE_SLUGS = new Set([
  'voda',
  'vodka-1-st-l',
  'ili-napolovinu-s-govyadinoy',
  'glutamat-natriya',
  'derevyannaya-shpazhka-po-zhelaniyu',
  'derevyannaya-shpazhka-2-sht',
  'derevyannaya-shpazhka-3-sht',
  'derevyannaya-shpazhka-4-sht',
  'dzhusay',
  'drozhzhevoe-testo-sdobnoe',
  'zavarka-chaynaya',
  'kaffir',
  'kashtany',
  'kipyatok',
  'kishki',
  'krov',
  'legkie',
  'lepestki-pertsa-chili',
  'losinoe-myaso',
  'lyubistok',
  'ovoschi',
  'ogurechnyy-rassol',
  'okorok',
  'osheek',
  'pazhitnik-semena',
  'pergament-po-zhelaniyu',
  'perets-chm',
  'perets-svezhemolotyy-smes',
  'portobello',
  'pripravy',
  'pryanosti',
  'radikkio',
  'rybnyy-sous-tayskiy',
  'rybnyy-sous-nam-pla',
  'svetloe-pivo-250-ml',
  'svinaya-golova',
  'svinoe-serdtse',
  'serdtse-barashka',
  'spetsii',
  'sushenye-travy-1-ch-l',
  'sushenye-travy-1-schepotka',
  'sychuzhnyy-ferment',
  'tamarindovaya-pasta',
  'travy-aromatnye',
  'travy-suhie',
  'tykvennoe-pyure',
  'fenhel',
  'frukty',
  'tsedra',
  'chay-chernyy-krepkiy',
  'cheremsha',
  'chiabatta-2-lomtik',
  'shalfey-1-puchok',
  'shnitt',
  'yagody-po-zhelaniyu',
  'yaichnye-belki',
  'yaichnye-zheltki',
]);

/** slug → category (только если запись остаётся в каталоге) */
const CATEGORY_BY_SLUG = {
  baranina: 'мясо',
  'govyazhiy-yazyk': 'мясо',
  'govyazhya-vyrezka': 'мясо',
  'govyazhya-tushenka-1-banka-300-g': 'мясо',
  krolik: 'мясо',
  'kurdyuchnyy-zhir': 'мясо',
  'kurinaya-golen': 'мясо',
  'kurinye-zheludochki': 'мясо',
  'kurinye-serdechki': 'мясо',
  'myaso-na-kostochke': 'мясо',
  'svinaya-koreyka': 'мясо',
  'svinaya-lopatka': 'мясо',
  'svinoe-file': 'мясо',
  'svinye-nozhki': 'мясо',
  'svinye-rebra': 'мясо',
  'steyk-iz-indeyki': 'мясо',
  'supovoy-nabor': 'мясо',
  telyatina: 'мясо',
  utka: 'мясо',
  'farsh-iz-indeyki': 'мясо',
  tsyplenok: 'мясо',
  'tsyplenok-tushka': 'мясо',
  anchousy: 'рыба',
  'gorbusha-1-kg': 'рыба',
  'krabovoe-myaso': 'рыба',
  'krabovye-palochki': 'рыба',
  moyva: 'рыба',
  'morskie-grebeshki': 'рыба',
  'morskoy-kokteyl-zamorozhennyy': 'рыба',
  'rybnoe-file': 'рыба',
  'rybnye-obrezki-golovy-plavniki': 'рыба',
  sibas: 'рыба',
  'steyk-iz-foreli': 'рыба',
  'steyk-lososya': 'рыба',
  'file-lososya': 'рыба',
  'file-seldi': 'рыба',
  'file-treski': 'рыба',
  'file-heka': 'рыба',
  'file-schuki': 'рыба',
  ayva: 'фрукты',
  vinograd: 'фрукты',
  golubika: 'фрукты',
  granat: 'фрукты',
  greypfrut: 'фрукты',
  'ezhevika-zamorozhennaya': 'фрукты',
  kivi: 'фрукты',
  'laym-1-sht': 'фрукты',
  'perets-bolg': 'овощи',
  daykon: 'овощи',
  'zamorozhennaya-ovoschnaya-smes': 'овощи',
  'perets-ostryy': 'овощи',
  'pobegi-seldereya': 'овощи',
  'goroh-suhoy': 'бакалея',
  kuskus: 'бакалея',
  mash: 'бакалея',
  'badyan-zvezdochka': 'зелень',
  'zelen-1-puchok': 'зелень',
  'zelen-po-zhelaniyu': 'зелень',
  'kumin-1-st-l': 'зелень',
  kinza: 'зелень',
  petrushka: 'зелень',
  'perets-krasnyy-molotyy': 'зелень',
  'muskatnyy-oreh-1-schepotka': 'зелень',
  imbir: 'зелень',
  'perets-krasnyy-zhguchiy': 'зелень',
  'perets-ostryy-molotyy': 'зелень',
  'perets-krasnyy-hlopyami': 'зелень',
  'priprava-dlya-kartofelya': 'зелень',
  'priprava-dlya-kuritsy': 'зелень',
  'priprava-dlya-plova-2-ch-l': 'зелень',
  'priprava-dlya-ryby': 'зелень',
  'priprava-k-myasu': 'зелень',
  'provanskie-travy-1-ch-l': 'зелень',
  'provanskie-travy-05-ch-l': 'зелень',
  rukola: 'зелень',
  'svezhaya-zelen': 'зелень',
  'smes-pertsev': 'зелень',
  'smes-provanskih-trav': 'зелень',
  'sparzha-zelenaya': 'зелень',
  'sredizemnomorskie-travy': 'зелень',
  'stebel-seldereya': 'зелень',
  'sushenaya-zelen': 'зелень',
  tarhun: 'зелень',
  'hlopya-chili': 'зелень',
  'shafran-1-st-l': 'зелень',
  'schavel-svezhiy': 'зелень',
  'chesnochnyy-poroshok': 'зелень',
  gvozdika: 'зелень',
  'zelen-rublenaya': 'зелень',
  'priprava-5-spetsiy-five-spice': 'зелень',
};

const RENAME_BY_SLUG = {
  krolik: 'Кролик',
  'goroh-suhoy': 'Горох',
  'badyan-zvezdochka': 'Бадьян',
  'muskatnyy-oreh-1-schepotka': 'Мускатный орех',
  'priprava-5-spetsiy-five-spice': 'Приправа «5 специй»',
  imbir: 'Корень имбиря',
  'perets-krasnyy-zhguchiy': 'Перец красный острый',
};

const NEW_INGREDIENTS = [
  {
    slug: 'kinza',
    nameRu: 'Кинза',
    category: 'зелень',
    aliases: ['маленький пучок кинзы', 'небольшой пучок кинзы'],
  },
  {
    slug: 'tsyplenok',
    nameRu: 'Цыпленок',
    category: 'мясо',
    aliases: ['небольшой цыпленок'],
  },
  {
    slug: 'tsyplenok-tushka',
    nameRu: 'Цыпленок тушка',
    category: 'мясо',
    aliases: ['тушка цыпленка', 'цыплята тушки'],
  },
  {
    slug: 'mash',
    nameRu: 'Маш',
    category: 'бакалея',
    aliases: ['маш тм «националь»'],
  },
  {
    slug: 'morskie-grebeshki',
    nameRu: 'Морские гребешки',
    category: 'рыба',
    aliases: ['морские гребешки тм «магуро»'],
  },
  {
    slug: 'granat',
    nameRu: 'Гранат',
    category: 'фрукты',
    aliases: ['гранатные зерна', 'зерна граната'],
  },
  {
    slug: 'perets-ostryy',
    nameRu: 'Перец острый',
    category: 'овощи',
    aliases: ['перец острый зеленый', 'перец чили'],
  },
  {
    slug: 'krolik',
    nameRu: 'Кролик',
    category: 'мясо',
    aliases: ['кролик задняя часть'],
  },
  {
    slug: 'perets-krasnyy-molotyy',
    nameRu: 'Перец красный молотый',
    category: 'зелень',
    aliases: ['молотый красный перец'],
  },
];

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));

const bySlug = new Map(catalog.map((x) => [x.slug, x]));

for (const ing of NEW_INGREDIENTS) {
  if (!bySlug.has(ing.slug)) {
    catalog.push(ing);
    bySlug.set(ing.slug, ing);
  }
}

const peretsZh = bySlug.get('perets-krasnyy-zhguchiy');
if (peretsZh) {
  peretsZh.nameRu = 'Перец красный острый';
  peretsZh.category = 'зелень';
}

addAlias(catalog, 'mayonez', '«Московский Провансаль» от бренда «Я люблю готовить»');
addAlias(catalog, 'perets-bolg', 'Болгарский красный перец');
addAlias(catalog, 'petrushka', 'Маленький пучок петрушки');
addAlias(catalog, 'petrushka', 'Небольшой пучок петрушки');
addAlias(catalog, 'farsh-smeshannyy', 'Мясной фарш');
addAlias(catalog, 'farsh-smeshannyy', 'Фарш мясной');
addAlias(catalog, 'svinye-rebra', 'Ребра свиные');
addAlias(catalog, 'svinye-rebra', 'Свиные ребрышки');
addAlias(catalog, 'goroh-suhoy', 'Горох колотый');
addAlias(catalog, 'perets-ostryy', 'Перец красный острый');

for (const [slug, category] of Object.entries(CATEGORY_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.category = category;
}

for (const [slug, nameRu] of Object.entries(RENAME_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.nameRu = nameRu;
}

let recipeSlugFixes = 0;
let recipeIngredientRemoved = 0;

for (const recipe of recipes) {
  const next = [];
  for (const ri of recipe.ingredients ?? []) {
    if (DELETE_SLUGS.has(ri.slug)) {
      recipeIngredientRemoved++;
      continue;
    }
    const merged = MERGE_SLUGS[ri.slug];
    if (merged) {
      ri.slug = merged;
      recipeSlugFixes++;
    }
    next.push(ri);
  }
  recipe.ingredients = next;
}

const removeSlugs = new Set([...Object.keys(MERGE_SLUGS), ...DELETE_SLUGS]);
const before = catalog.length;
const nextCatalog = catalog.filter((ing) => !removeSlugs.has(ing.slug));

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

console.log(
  [
    `Catalog: ${before} → ${nextCatalog.length}`,
    `removed slugs: ${removeSlugs.size}`,
    `recipe slug merges: ${recipeSlugFixes}`,
    `recipe ingredients dropped: ${recipeIngredientRemoved}`,
  ].join('\n'),
);
