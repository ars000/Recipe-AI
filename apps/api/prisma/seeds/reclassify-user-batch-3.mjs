/**
 * Замечания пользователя: слияния, удаления, категории.
 * node apps/api/prisma/seeds/reclassify-user-batch-3.mjs
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { normalizeIngredientDisplayName } = require('@recipe-manager/shared');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ingredientsPath = join(__dirname, 'ingredients.json');
const recipesPath = join(__dirname, 'recipes.seed.json');

const DELETE_SLUGS = new Set([
  'bulon-ovoschnoy',
  'kuritsa-varenaya',
  'krupnye-lukovitsy',
  'kurinyy-ili-ovoschnoy-bulon',
  'listovoy-salat-podmoskovnyy-rukola-ili-drugoy',
  'luk-repchatyy-melkiy',
  'morkov-varenaya',
  'morkov-po',
  'morkov-tertaya',
  'ovoschi',
  'ovoschnoy-bulon',
  'ogurechnyy-rassol',
  'ogurets-marinovannyy',
  'olivkovoe-maslo-nastoyannoe-na-chesnoke',
  'sladkaya-paprika',
  'grushi',
  'zerna-granata-po-zhelaniyu',
  'laym-listya',
  'lemongrass-limonnoe-sorgo',
  'limonnaya-kislota',
  'limonnik-stebel',
  'limony',
  'krabovye-palochki-vici',
  'krevetki-tm-maguro',
  'krupnye-otvarennye-i-ochischennye-krevetki',
  'aromatnye-italyanskie-travy-s-paprikoy',
  'vermishel-rolton',
  'belyy-hleb-dlya-suharikov',
  'domashniy-mayonez',
  'mayonez-domashniy',
  'mayoran-suhoy',
  'med-zhidkiy',
  'myasnoy-bulon',
  'myata-sushenaya',
  'pergament-po-zhelaniyu',
  'pasternak',
  'zavarka-chaynaya',
  'vcherashniy-zernovoy-hleb',
  'vusterskiy-sous',
]);

const MERGE_SLUGS = {
  'belokochannaya-kapusta-1-kochan': 'kapusta',
  'belokochannaya-kapusta': 'kapusta',
  'zelenyy-luk-5-pero': 'zelenyy-luk-pero',
  'zelenyy-luk': 'zelenyy-luk-pero',
  'kabachki-molodye': 'kabachok',
  'kartofel-varenyy': 'kartofel',
  'kartofel-varenyy-v-mundire': 'kartofel',
  'krasnye-pomidory': 'pomidor',
  'krupnye-pomidory': 'pomidor',
  'krupnye-sladkie-pomidory': 'pomidor',
  'listovoy-salat': 'salat-list',
  'malenkiy-puchok-krasnogo-bazilika': 'bazilik-svezhiy',
  'malenkiy-puchok-ukropa': 'ukrop-svezhiy',
  'nebolshoy-puchok-ukropa': 'ukrop',
  'morkov-krupnaya': 'morkov',
  'nebolshaya-svekla': 'svekla',
  'nebolshie-ogurtsy': 'ogurets',
  'bolshaya-zhirnaya-seld': 'seld',
  'korolevskie-krevetki': 'krevetki',
  'yogurt-grecheskiy': 'yogurt',
  'yogurt-zhirnyy': 'yogurt',
  'yogurt-naturalnyy': 'yogurt',
  'kartofelnyy-krahmal': 'krahmal',
  'kukuruznyy-krahmal': 'krahmal',
  'ketchup-tomatnyy': 'ketchup',
  'ketchup-tomatnyy-tm-maheev': 'ketchup',
  'kinza-2-vetochka': 'kinza-svezhaya',
  'kinza': 'kinza-svezhaya',
  'kopchenaya-paprika-po-zhelaniyu': 'paprika-molotaya',
  'paprika-krasnaya': 'paprika-molotaya',
  'paprika-krasnaya-molotaya': 'paprika-molotaya',
  paprika: 'paprika-molotaya',
  'mayoran-sushenyy': 'mayoran',
  'syr-maskarpone': 'maskarpone',
};

const NEW_INGREDIENTS = [
  {
    slug: 'zelenyy-luk-pero',
    nameRu: 'Зеленый лук перо',
    category: 'овощи',
    aliases: ['зеленый лук', 'зеленый лук 5 перо'],
  },
];

const DAIRY_SLUGS = new Set([
  'yogurt',
  'zhirnye-slivki',
  'kokosovye-slivki',
  'maskarpone',
  'toplenoe-maslo',
  'matsoni',
  'myagkiy-koziy-syr',
]);

const MEAT_SLUGS = new Set([
  'indyushachya-pechen',
  'indeyka-file',
  'indeyka-golen',
  'losinoe-myaso',
]);

const PROCHEE_SLUGS = new Set(['kolbasa', 'kolbasa-polukopchenaya']);

const ZELEN_SLUGS = new Set([
  'kinza-svezhaya',
  'mayoran',
  'myata',
  'kress',
  'ukrop-svezhiy',
  'bazilik-svezhiy',
  'ukrop',
]);

const RENAME_BY_SLUG = {
  krevetki: 'Креветки королевские',
  'ukrop-svezhiy': 'Укроп свежий',
  'bazilik-svezhiy': 'Базилик свежий',
  'kinza-svezhaya': 'Кинза свежая',
  kress: 'Кресс салат',
  'paprika-molotaya': 'Паприка молотая',
};

const CATEGORY_BY_SLUG = {
  'maslo-vinogradnyh-kostochek': 'бакалея',
  'vinogradnye-listya': 'овощи',
  krahmal: 'бакалея',
  ...Object.fromEntries([...DAIRY_SLUGS].map((s) => [s, 'молочное'])),
  ...Object.fromEntries([...MEAT_SLUGS].map((s) => [s, 'мясо'])),
  ...Object.fromEntries([...PROCHEE_SLUGS].map((s) => [s, 'прочее'])),
  ...Object.fromEntries([...ZELEN_SLUGS].map((s) => [s, 'зелень'])),
  'paprika-molotaya': 'зелень',
  mayoran: 'зелень',
};

function isBakaleyaSpice(ing) {
  if (ing.category !== 'бакалея') return false;
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  if (
    /рис|мука|макaron|лапша|крупa|консерв|konserv|орех|изюм|курага|чернослив|кетчуп|krakmal|уксus|горчица|масло|мед|фасол|горох|чечев|сахar|соль|vanil|сахар|крупa|сухар|квас|разрыхлит|сoda|уксus|соус|паста|bulgur|grech|ovsy|perlov|kuskus|kinoa|nutella|bulon|vermishel|drozhzhi|kakao|shokolad|oreh|kunzhut|semеч|семеч|уксus|уксус|уксус|рисов|уксus|уксus/.test(
      t,
    )
  ) {
    return false;
  }
  return (
    /приправ|специ[^i]|кori[ct]|пaprika|гvozd|бадьян|кumin|zira|кarri|имбир|muscat|мускат|лавр|куркум|перец|пaprika|пaprika|vanil|кoriand|тмин|пryano|чесноч.*порош|молot|горошkom|укроп\s+суш|петруш.*суш|базилик\s+суш|тимьян|розмарин\s+суш|mayoran|oregano|paprika|кhmel|букет\s+гарни|прован|трав/.test(
      t,
    ) ||
    ['koritsa', 'laurel', 'lavr', 'gvozdika', 'badyan-zvezdochka', 'kumin-1-st-l', 'zira', 'karri', 'paprika-molotaya'].includes(
      ing.slug,
    )
  );
}

function addAlias(catalog, targetSlug, phrase) {
  const ing = catalog.find((x) => x.slug === targetSlug);
  if (!ing || !phrase) return;
  const key = phrase.toLowerCase().trim();
  const existing = new Set([ing.nameRu, ...(ing.aliases ?? [])].map((a) => a.toLowerCase().trim()));
  if (existing.has(key)) return;
  ing.aliases = [...(ing.aliases ?? []), phrase];
}

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const bySlug = new Map(catalog.map((x) => [x.slug, x]));

for (const ing of NEW_INGREDIENTS) {
  if (!bySlug.has(ing.slug)) {
    catalog.push(ing);
    bySlug.set(ing.slug, ing);
  }
}

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

for (const [slug, category] of Object.entries(CATEGORY_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.category = category;
}

for (const ing of catalog) {
  if (isBakaleyaSpice(ing)) ing.category = 'зелень';
}

for (const [slug, nameRu] of Object.entries(RENAME_BY_SLUG)) {
  const ing = bySlug.get(slug);
  if (ing) ing.nameRu = nameRu;
}

for (const [from, to] of Object.entries(MERGE_SLUGS)) {
  const src = bySlug.get(from);
  if (src) addAlias(catalog, to, src.nameRu);
}

let recipeMerged = 0;
let recipeDropped = 0;
for (const recipe of recipes) {
  const next = [];
  for (const ri of recipe.ingredients ?? []) {
    if (DELETE_SLUGS.has(ri.slug)) {
      recipeDropped++;
      continue;
    }
    const merged = MERGE_SLUGS[ri.slug];
    if (merged) {
      ri.slug = merged;
      recipeMerged++;
    }
    next.push(ri);
  }
  recipe.ingredients = next;
}

const removeSlugs = new Set([...DELETE_SLUGS, ...Object.keys(MERGE_SLUGS)]);
const before = catalog.length;
const nextCatalog = catalog.filter((ing) => !removeSlugs.has(ing.slug));

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

console.log(
  [
    `Catalog: ${before} → ${nextCatalog.length}`,
    `зелень: ${nextCatalog.filter((x) => x.category === 'зелень').length}`,
    `бакалея: ${nextCatalog.filter((x) => x.category === 'бакалея').length}`,
    `recipe merged: ${recipeMerged}, dropped: ${recipeDropped}`,
  ].join('\n'),
);
