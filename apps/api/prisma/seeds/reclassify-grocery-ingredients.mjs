/**
 * Консервы, крупы, мука, макароны, сахар, соль, специи → «бакалея»; слияние дублей.
 * node apps/api/prisma/seeds/reclassify-grocery-ingredients.mjs
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

/** Свежая зелень — остаётся в категории «зелень». */
const FRESH_HERB_SLUGS = new Set([
  'ukrop',
  'petrushka',
  'bazilik',
  'kinza',
  'rukola',
  'rozmarin',
  'tarkhun',
  'kress',
  'zelen-1-puchok',
  'zelen-po-zhelaniyu',
  'zelen-rublenaya',
  'svezhaya-zelen',
  'schavel-svezhiy',
]);

/** Явные слияния slug → канонический slug. */
const EXPLICIT_MERGE = {
  'govyazhya-tushenka-1-banka': 'govyazhya-tushenka-1-banka-300-g',
  'kukuruza-konservirovannaya-1-banka': 'kukuruza',
  'kukuruza-konservirovannaya-po-zhelaniyu': 'kukuruza',
  'kukuruza-konservirovannaya-tm-frau-marta': 'kukuruza',
  'tunets-konservirovannyy-tm-maguro': 'tunets',
  'konservirovannaya-sayra-1-banka': 'konservirovannaya-sayra-1-banka-250-g',
  'konservirovannye-sardiny-1-banka': 'konservirovannye-sardiny-1-banka-200-g',
  'konservirovannye-shproty-1-banka': 'konservirovannye-shproty-1-banka-200-g',
  'konservirovannye-shproty-6-sht': 'konservirovannye-shproty-1-banka-200-g',
  'konservirovannye-shproty': 'konservirovannye-shproty-1-banka-200-g',
  'konservirovannyy-goroshek': 'goroh',
  'goroshek-zelenyy-konservirovannyy': 'goroh',
  'goroshek-konservirovannyy-tm-frau-marta': 'goroh',
  'fasol-belaya-konservirovannaya': 'fasol',
  'krasnaya-fasol-1-banka': 'krasnaya-fasol',
  'ryba-konservirovannaya': 'rybnye-konservy',
  'pasta-talyatelle': 'makaron',
  'talyatelle': 'makaron',
  'pasta-farfalle': 'makaron',
  'penne': 'makaron',
  'krupnye-makarony': 'makaron',
  'dlinnye-shirokie-makarony': 'makaron',
  'grechka-1-stakan': 'grechka',
  'pshenichnaya-muka': 'muka',
  'pshenichnaya-muka-hlebopekarnaya': 'muka',
  'pshenichnaya-muka-hlebopekarnaya-1-stakan': 'muka',
  'pshenichnaya-muka-hlebopekarnaya-15-stakan': 'muka',
  'pshenichnaya-muka-hlebopekarnaya-3-stakan': 'muka',
  'pshenichnaya-muka-hlebopekarnaya-05-stakan': 'muka',
  'pshenichnaya-muka-hlebopekarnaya-03-stakan': 'muka',
  'pshenichnaya-muka-hlebopekarnaya-1-schepotka': 'muka',
  'pshenichnaya-muka-tselnozernovaya': 'muka',
  'kukuruznaya-muka': 'muka',
  'risovaya-muka': 'muka',
  'yaponskiy-ris': 'ris',
  'kruglozernovoy-ris': 'ris',
  'kruglozernovoy-ris-1-stakan': 'ris',
  'ris-dlya-plova': 'ris',
  'ris-dlya-sushi': 'ris',
  'ris-dlinnozernyy-05-stakan': 'ris',
  'ris-kruglozernyy': 'ris',
  'ris-otvarnoy': 'ris',
  'ris-varenyy': 'ris',
  'ris-buryy': 'ris',
  'ris-yaponika': 'ris',
  'ris-arborio': 'ris',
  'ris-adriatika-tm-natsional': 'ris',
  'ris-krasnodarskiy-tm-natsional': 'ris',
  'chechevitsa-krasnaya': 'chechevitsa',
  'chechevitsa-krasnaya-tm-natsional': 'chechevitsa',
  'belaya-fasol': 'fasol',
  'fasol-krasnaya': 'fasol',
  'fasol-zelenaya-struchkovaya': 'fasol-struchkovaya',
  'kinoa-tm-natsional': 'kinoa',
  'bulgur-tm-natsional': 'bulgur',
  'ovsyanye-hlopya-po-zhelaniyu': 'ovsyanka',
  'perets-chernyy-goroshkom': 'perets',
  'perets-goroshkom': 'perets',
  'perets-dushistyy-goroshkom': 'perets',
  'chernyy-perets-goroshkom': 'perets',
  'dushistyy-perets-goroshkom': 'perets',
  'perets-goroshkom-smes': 'perets',
};

const PREFERRED_CANONICAL = {
  'Кукуруза консервированная': 'kukuruza',
  'Тунец консервированный': 'tunets',
  'Сайра консервированная': 'konservirovannaya-sayra-1-banka-250-g',
  'Сардины консервированные': 'konservirovannye-sardiny-1-banka-200-g',
  'Шпроты консервированные': 'konservirovannye-shproty-1-banka-200-g',
  'Говяжья тушенка': 'govyazhya-tushenka-1-banka-300-g',
  'Горошек зелёный': 'goroh',
  'Мука': 'muka',
  'Рис': 'ris',
  'Гречка': 'grechka',
  'Макароны': 'makaron',
  'Фасоль': 'fasol',
};

function isCanned(ing) {
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  return /консерв|konserv/.test(t);
}

function isMeatCan(ing) {
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  return /тушенк|паштет|мяс.*консерв|корнева.*консерв/.test(t);
}

function isStapleGrocery(ing) {
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  if (/рисов(ое|ый|ая)\s+(вино|уксус|бумага)|nutella|йогурт|салат\s+фриссе|barbaris|тamarind/.test(t)) {
    return false;
  }
  if (/заморож|стручков|свеж|салат-/.test(t) && !/консерв|konserv/.test(t)) {
    if (/фасол|горош|кукуруз|огур|помидор|гриб/.test(t)) return false;
  }
  if (
    /^(рис|греч|перлов|кускус|овсян|манн|киноа|булгур|чечев|фасол|горох|горош|мука|макaron|макaron|лапша|спагет|пенне|фунчоз|тальятел|фarfalle|крупa|сахар|соль)\b/.test(
      ing.nameRu.toLowerCase(),
    )
  ) {
    return true;
  }
  return (
    /рис|гречк|перлов|кускус|овсян|манн|киноа|булгур|чечевиц|фасол|горох|горошек|мука|макaron|макaron|лапша|паста|пенне|фунчоз|тальятел|фarfalle|крупa|сахар|соль/.test(
      t,
    ) &&
    !/вino|уксус|бумаг|вареный|отварн/.test(t)
  );
}

function isSpiceProduct(ing) {
  if (ing.category === 'овощи' || ing.category === 'соусы') return false;
  if (FRESH_HERB_SLUGS.has(ing.slug)) return false;
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  if (/соус|кетчуп|майонез|mayonez|масло(?!.*перец)/.test(t) && !/перец|приправ/.test(t)) {
    return false;
  }
  if (/перец/.test(t) && /(болгар|острый|чili|chili)/.test(t) && ing.category === 'овощи') {
    return false;
  }
  return (
    /приправ|кori[ct]|пaprika|пaprika|гvozd|бадьян|кumin|имбир|muscat|мускат|лавров|куркум|кардамон|шаfran|шаffran|бasiлик\s+суш|укроп\s+суш|петруш.*суш|сушен.*укроп|сушен.*петруш|молot|горошkom|перец|уксus|соль|сахar|vanil|кориандр|тмин|укроп\s+сух|пряност|специ[^i]|чесноч.*порош|пaprika|dushist|белый\s+перец/.test(
      t,
    ) ||
    ['koritsa', 'paprika', 'laurel', 'sol', 'sahar', 'vanil', 'imbir', 'perets', 'bazilik-sushenyy'].includes(
      ing.slug,
    )
  );
}

function shouldBeBakaleya(ing) {
  if (FRESH_HERB_SLUGS.has(ing.slug)) return false;
  if (ing.category === 'зелень') return true;
  if (isCanned(ing) || isMeatCan(ing)) return true;
  if (isStapleGrocery(ing)) return true;
  if (isSpiceProduct(ing)) return true;
  if (['sol', 'sahar', 'muka', 'ris', 'makaron', 'grechka', 'perlovka', 'lapsha', 'kuskus', 'ovsyanka', 'bulgur', 'kinoa', 'chechevitsa', 'nut', 'fasol', 'goroh', 'goroh-suhoy', 'mash'].includes(ing.slug)) {
    return true;
  }
  return false;
}

function slugScore(slug) {
  let s = 0;
  if (!/\d/.test(slug)) s += 20;
  if (!/banka|st-l|stakan|schepot|ml|g-/.test(slug)) s += 10;
  s -= slug.length * 0.05;
  return s;
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

for (const ing of catalog) {
  if (shouldBeBakaleya(ing)) ing.category = 'бакалея';
}

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

const mergeSlugs = { ...EXPLICIT_MERGE };

const bakaleya = catalog.filter((x) => x.category === 'бакалея');
const byNorm = new Map();
for (const ing of bakaleya) {
  const key = ing.nameRu.toLowerCase();
  if (!byNorm.has(key)) byNorm.set(key, []);
  byNorm.get(key).push(ing);
}

for (const [norm, group] of byNorm) {
  if (group.length < 2) continue;
  const preferred = PREFERRED_CANONICAL[group[0].nameRu];
  let canonical = preferred
    ? group.find((g) => g.slug === preferred)
    : [...group].sort((a, b) => slugScore(b.slug) - slugScore(a.slug))[0];
  if (!canonical) canonical = group[0];
  for (const ing of group) {
    if (ing.slug === canonical.slug) continue;
    mergeSlugs[ing.slug] = canonical.slug;
    addAlias(catalog, canonical.slug, ing.nameRu);
  }
}

let recipeFixes = 0;
for (const recipe of recipes) {
  for (const ri of recipe.ingredients ?? []) {
    const target = mergeSlugs[ri.slug];
    if (target) {
      ri.slug = target;
      recipeFixes++;
    }
  }
}

const remove = new Set(Object.keys(mergeSlugs));
const before = catalog.length;
const nextCatalog = catalog.filter((ing) => !remove.has(ing.slug));

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

console.log(
  [
    `Catalog: ${before} → ${nextCatalog.length}`,
    `merged slugs: ${remove.size}`,
    `recipe slug fixes: ${recipeFixes}`,
    `бакалея items: ${nextCatalog.filter((x) => x.category === 'бакалея').length}`,
    `зелень items: ${nextCatalog.filter((x) => x.category === 'зелень').length}`,
  ].join('\n'),
);
