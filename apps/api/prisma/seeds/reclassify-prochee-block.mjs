/**
 * Чистка блока «Прочее»: удаление, перенос по категориям, слияние дублей.
 * node apps/api/prisma/seeds/reclassify-prochee-block.mjs
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

const DELETE_SLUG_PREFIXES = ['voda', 'vodka'];
const DELETE_SLUGS = new Set([
  'vok',
  'kashtany',
  'kaffir',
  'dzhusay',
  'zakvaska',
  'krov',
  'frukty',
  'yagody',
  'yagody-po-zhelaniyu',
  'ili-napolovinu-s-govyadinoy',
]);

function shouldDelete(ing) {
  if (DELETE_SLUGS.has(ing.slug)) return true;
  return DELETE_SLUG_PREFIXES.some((p) => ing.slug === p || ing.slug.startsWith(`${p}-`));
}

function isFishSeafood(ing) {
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  if (/икра|кrevet|кalmар|мидии|устриц|краб|лosos|losos|semga|forel|skumbri|seld|tunets|ryba|gorbush|treska|sudak|karp|kambala|vodorosl|nori|chuka|shprot|sardin|sayra|ikra|морепродукт|рыбн|анчоус|устриц|осьмин|кревет|скумбр|форел|сёмг|семг|сельд|треск|камбал|судак|кarp|шпрот|сардин|сайра|тунец|окунь|okun/.test(t)) {
    return true;
  }
  return /^(ikra|losos|semga|forel|skumbriya|krevet|kalmary|treska|sudak|karp|kambala|shproty|ryba-|rybnyy-bulon)/.test(
    ing.slug,
  );
}

function isFruit(ing) {
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  if (/сок|джем|варень|вino|комpot|nectar|drink/.test(t) && !/тomat/.test(t)) return false;
  if (/цедра|кожура/.test(t) && /limon|laym|apelsin/.test(t)) return false;
  return (
    /^(yablok|banan|apelsin|limon|laym|grush|vinograd|klubnik|malin|chernik|kivi|anan|mango|persik|sliv|greypfrut|golubik|klyukv|arbu|dyn|frukt|mandarin|avokado|granat|ayva|hurma|vishn)/.test(
      ing.slug,
    ) ||
    /яблок|банан|апельсин|лимон|лайм|груш|виноград|клубник|малин|черник|киви|ананас|манго|персик|слив|грейпфрут|голубик|клюкв|арбуз|дын|авокад|гранат|айва|хурм|вишн|черешн|облепих|крыжовник/.test(
      t,
    )
  );
}

function isVegetable(ing) {
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  if (isFruit(ing)) return false;
  return (
    /^(pomidor|kartofel|luk|morkov|kapust|ogurec|ogur|perets|baklazhan|kabach|tikv|chesnok|redis|redisk|redk|selderey|shpinat|salat|grib|shampinon|veshenk|lisichk|portobello|brokkoli|tykva|fenhel|daykon|batat|paprika|patisson|ukrop|kinza|bazilik|petrush|rukola|zelen|schavel|porей|luk-|pomid|kartof|morkov|ogur|kapust|chesn|redis|selder|shpinat|salat-|grib|portobello|brokkoli|tykven|fenhel|chuk|perec-bolg|zelenyy-luk|kitaysk)/.test(
      ing.slug,
    ) ||
    /помидор|томат|картоф|морков|капуст|огур|перец|баклаж|кабач|цукин|тыкв|чеснок|редис|редьк|сельдер|шпинат|салат|гриб|шампиньон|вешенк|лисичк|брокколи|батат|лук|порей|зелен.*лук|капер|маринован.*огур|солен.*огур|фасол.*струч|горош.*заморож|овощ|петруш|укроп|кинза|базилик|рукола|щавель|фенхель|дайкон|портобелло|редис|свекл|сельдер|листовой салат|айсберг|ромano|радиккио|шпинат|кабач|баклаж|перец|папrika/.test(
      t,
    )
  );
}

function isNutsOrDriedFruit(ing) {
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  if (/молок|сливк|масло кокос/.test(t)) return false;
  return (
    /oreh|oresh|arahis|funduk|fistash|kedr|kunzhut|izyum|kuraga|chernosliv|tsukat|sushen.*klyukv|vyalen|suhofrukt|миндал|грецк.*орех|кедров|фундук|фисташ|арахис|кунжут|изюм|курага|чернослив|цукат|сушен.*клюкв|вялен|финик|инжир|кокосовая\s+стружк|семечк|семян.*подсолнеч|тыквен.*семеч|семечк/.test(
      t,
    ) || ['orehi', 'izyum', 'kuraga', 'chernosliv'].includes(ing.slug)
  );
}

function isSpice(ing) {
  const t = `${ing.nameRu} ${ing.slug}`.toLowerCase();
  if (/соус|кетчуп|майонез|уксус|масло|горчица/.test(t) && !/перец|приправ|spice|кori|пaprika|кarri/.test(t)) {
    return false;
  }
  return (
    /приправ|специ[^i]|кori[ct]|пaprika|гvozd|бадьян|кumin|zira|кarri|имбир|muscat|мускат|лавр|куркум|кардамон|шаfran|шаffran|vanil|кoriand|тмин|пaprika|перец\s+(молot|горош|красн|черн|бел|душист|сладк)|молot.*перец|горошkom|чесноч.*порош|пoroshok.*chesn|сушен.*укроп|сушен.*петруш|сушен.*базилик|сушен.*чеснок|сушен.*тим|сухой\s+тим|кopchen.*paprika|букет\s+гарни|итальянск.*трав|прован|трав.*арomat|трав.*сух|пряnost|разрыхлит|сода|карри|куркум|galangal|галангал|барbaris|кhmel|хmel|перец|dushist|koritsa|paprika|laurel|lavr|shafran|italyanskie-travy|travy-|buket-garni|smes.*perts|perets-|molot|garn/.test(
      t,
    ) ||
    /^(koritsa|paprika|laurel|lavr|zira|karri|khmeli|shafran|italyanskie-travy|travy-aromatnye|travy-suhie|buket-garni|sushenye-travy|razryhlitel|soda|galangal-koren|poroshok-chesnochnyy|smes-neskolkih-vidov-pertsa|timyan-sushen|rozmarin-sushen|suhoy-timyan|sushenyy-timyan)/.test(
      ing.slug,
    )
  );
}

function slugScore(slug) {
  let s = 0;
  if (!/\d/.test(slug)) s += 20;
  if (!/banka|st-l|stakan|lomtik|ml|g-|po-zhelaniyu|sht/.test(slug)) s += 10;
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

function buildCanonicalByNorm(catalog) {
  const map = new Map();
  for (const ing of catalog) {
    if (ing.category === 'прочее') continue;
    const norm = normalizeIngredientDisplayName(ing.nameRu).toLowerCase();
    if (!map.has(norm)) map.set(norm, ing.slug);
  }
  return map;
}

const catalog = JSON.parse(readFileSync(ingredientsPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));

for (const ing of catalog) {
  ing.nameRu = normalizeIngredientDisplayName(ing.nameRu);
}

const procheeSlugs = new Set(catalog.filter((x) => x.category === 'прочее').map((x) => x.slug));

for (const ing of catalog) {
  if (ing.category !== 'прочее') continue;
  if (isFishSeafood(ing)) ing.category = 'рыба';
  else if (isNutsOrDriedFruit(ing)) ing.category = 'бакалея';
  else if (isFruit(ing)) ing.category = 'фрукты';
  else if (isVegetable(ing)) ing.category = 'овощи';
  else if (isSpice(ing)) ing.category = 'бакалея';
}

const canonicalByNorm = buildCanonicalByNorm(catalog);
const mergeSlugs = {};

for (const ing of catalog) {
  if (!procheeSlugs.has(ing.slug)) continue;
  const norm = ing.nameRu.toLowerCase();
  const targetSlug = canonicalByNorm.get(norm);
  if (targetSlug && targetSlug !== ing.slug) {
    mergeSlugs[ing.slug] = targetSlug;
    addAlias(catalog, targetSlug, ing.nameRu);
  }
}

const byNormProchee = new Map();
for (const ing of catalog) {
  if (ing.category !== 'прочее') continue;
  if (mergeSlugs[ing.slug]) continue;
  const norm = ing.nameRu.toLowerCase();
  if (!byNormProchee.has(norm)) byNormProchee.set(norm, []);
  byNormProchee.get(norm).push(ing);
}

for (const group of byNormProchee.values()) {
  if (group.length < 2) continue;
  const canonical = [...group].sort((a, b) => slugScore(b.slug) - slugScore(a.slug))[0];
  for (const ing of group) {
    if (ing.slug === canonical.slug) continue;
    mergeSlugs[ing.slug] = canonical.slug;
    addAlias(catalog, canonical.slug, ing.nameRu);
  }
}

let recipeRemoved = 0;
let recipeMerged = 0;
for (const recipe of recipes) {
  const next = [];
  for (const ri of recipe.ingredients ?? []) {
    if (shouldDelete({ slug: ri.slug }) || DELETE_SLUGS.has(ri.slug)) {
      recipeRemoved++;
      continue;
    }
    const merged = mergeSlugs[ri.slug];
    if (merged) {
      ri.slug = merged;
      recipeMerged++;
    }
    next.push(ri);
  }
  recipe.ingredients = next;
}

const removeSlugs = new Set([
  ...Object.keys(mergeSlugs),
  ...catalog.filter(shouldDelete).map((x) => x.slug),
]);

const before = catalog.length;
const nextCatalog = catalog.filter((ing) => !removeSlugs.has(ing.slug));

writeFileSync(ingredientsPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');
writeFileSync(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

const procheeLeft = nextCatalog.filter((x) => x.category === 'прочее').length;
console.log(
  [
    `Catalog: ${before} → ${nextCatalog.length}`,
    `deleted: ${catalog.filter(shouldDelete).length} (+ slug variants)`,
    `merged: ${Object.keys(mergeSlugs).length}`,
    `прочее left: ${procheeLeft}`,
    `recipe merges: ${recipeMerged}, dropped: ${recipeRemoved}`,
  ].join('\n'),
);
