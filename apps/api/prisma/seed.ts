import { normalizeRecipeTags } from '@recipe-manager/shared';
import { PrismaClient, RecipeSource } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

type IngredientSeed = {
  slug: string;
  nameRu: string;
  category: string;
  aliases: string[];
};

type RecipeSeed = {
  title: string;
  description?: string;
  sourceUrl: string;
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  imageUrl?: string | null;
  tags: string[];
  sourceTags?: string[];
  ingredients: Array<{
    slug: string;
    nameRu?: string;
    amount?: number;
    unit?: string;
    optional?: boolean;
  }>;
  steps: string[];
};

function buildIngredientCreates(
  recipe: RecipeSeed,
  slugToId: Map<string, string>,
) {
  return recipe.ingredients
    .map((ri) => {
      const ingredientId = slugToId.get(ri.slug);
      if (!ingredientId) {
        console.warn(`Unknown slug ${ri.slug} in ${recipe.title}`);
        return null;
      }
      const labelRu = ri.nameRu?.trim() || null;
      return {
        ingredientId,
        labelRu,
        amount: ri.amount,
        unit: ri.unit,
        optional: ri.optional ?? false,
      };
    })
    .filter(Boolean) as Array<{
    ingredientId: string;
    labelRu: string | null;
    amount?: number;
    unit?: string;
    optional: boolean;
  }>;
}

function sourceUrlOccurrenceIndex(
  recipes: RecipeSeed[],
  recipe: RecipeSeed,
): number {
  let n = 0;
  for (const row of recipes) {
    if (row === recipe) return n;
    if (row.sourceUrl && row.sourceUrl === recipe.sourceUrl) n++;
  }
  return 0;
}

async function findSeedRecipeRow(
  recipe: RecipeSeed,
  recipes: RecipeSeed[],
) {
  if (recipe.sourceUrl) {
    const siblings = await prisma.recipe.findMany({
      where: { sourceUrl: recipe.sourceUrl },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (siblings.length) {
      const idx = sourceUrlOccurrenceIndex(recipes, recipe);
      return siblings[idx] ?? siblings[0];
    }
  }

  return prisma.recipe.findFirst({
    where: { title: recipe.title },
    select: { id: true },
  });
}

async function syncSeedRecipes(
  recipes: RecipeSeed[],
  slugToId: Map<string, string>,
) {
  let updated = 0;
  let created = 0;
  for (const recipe of recipes) {
    const existing = await findSeedRecipeRow(recipe, recipes);
    const ingredientCreates = buildIngredientCreates(recipe, slugToId);

    if (!existing) {
      await prisma.recipe.create({
        data: {
          title: recipe.title,
          description: recipe.description ?? null,
          instructions: recipe.steps,
          servings: recipe.servings,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          imageUrl: recipe.imageUrl ?? null,
          sourceUrl: recipe.sourceUrl,
          source: RecipeSource.seed,
          tags: recipe.tags,
          ingredients: { create: ingredientCreates },
        },
      });
      created++;
      continue;
    }

    await prisma.recipe.update({
      where: { id: existing.id },
      data: {
        title: recipe.title,
        description: recipe.description ?? null,
        instructions: recipe.steps,
        sourceUrl: recipe.sourceUrl,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        servings: recipe.servings,
        imageUrl: recipe.imageUrl ?? null,
        tags: recipe.tags,
      },
    });

    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: existing.id },
    });
    if (ingredientCreates.length) {
      await prisma.recipeIngredient.createMany({
        data: ingredientCreates.map((ri) => ({
          recipeId: existing.id,
          ingredientId: ri.ingredientId,
          labelRu: ri.labelRu,
          amount: ri.amount ?? null,
          unit: ri.unit ?? null,
          optional: ri.optional,
        })),
      });
    }
    updated++;
  }
  console.log(
    `Synced seed recipes: ${updated} updated, ${created} created (${recipes.length} in file).`,
  );
}

async function pruneSeedRecipesAbsentFromFile(recipes: RecipeSeed[]) {
  const urls = new Set(
    recipes.map((r) => r.sourceUrl).filter((u): u is string => Boolean(u)),
  );
  const orphans = await prisma.recipe.findMany({
    where: {
      source: RecipeSource.seed,
      OR: [{ sourceUrl: null }, { sourceUrl: { notIn: [...urls] } }],
    },
    select: { id: true, title: true },
  });
  for (const row of orphans) {
    await prisma.recipe.delete({ where: { id: row.id } });
  }
  if (orphans.length) {
    console.log(`Removed ${orphans.length} seed recipe(s) no longer in seed file.`);
  }
}

async function pruneIngredientsAbsentFromSeedFile(
  keepSlugs: Set<string>,
  retireIngredientSlug: (slug: string, migrateToSlug?: string) => Promise<void>,
) {
  const rows = await prisma.ingredient.findMany({ select: { slug: true } });
  let removed = 0;
  for (const row of rows) {
    if (keepSlugs.has(row.slug)) continue;
    await retireIngredientSlug(row.slug);
    removed++;
  }
  if (removed) {
    console.log(`Removed ${removed} ingredient(s) no longer in seed file.`);
  }
}

async function pruneExtraSeedSourceUrlRows(recipes: RecipeSeed[]) {
  const keepByUrl = new Map<string, number>();
  for (const recipe of recipes) {
    if (!recipe.sourceUrl) continue;
    keepByUrl.set(
      recipe.sourceUrl,
      (keepByUrl.get(recipe.sourceUrl) ?? 0) + 1,
    );
  }

  let removed = 0;
  for (const [sourceUrl, keep] of keepByUrl) {
    const rows = await prisma.recipe.findMany({
      where: { sourceUrl, source: RecipeSource.seed },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const excess = rows.length - keep;
    if (excess <= 0) continue;

    for (const row of rows.slice(0, excess)) {
      await prisma.recipe.delete({ where: { id: row.id } });
      removed++;
    }
  }

  if (removed) {
    console.log(`Removed ${removed} duplicate seed recipe row(s) by sourceUrl.`);
  }
}

async function main() {
  const seedsDir = join(__dirname, 'seeds');
  const ingredients: IngredientSeed[] = JSON.parse(
    readFileSync(join(seedsDir, 'ingredients.json'), 'utf8'),
  );
  const recipes: RecipeSeed[] = JSON.parse(
    readFileSync(join(seedsDir, 'recipes.seed.json'), 'utf8'),
  );

  for (const recipe of recipes) {
    recipe.tags = normalizeRecipeTags(
      recipe.title,
      recipe.sourceTags?.length ? recipe.sourceTags : recipe.tags,
      recipe.prepMinutes,
      recipe.cookMinutes,
    );
  }

  const defaultUserId =
    process.env.DEFAULT_USER_ID ?? '00000000-0000-4000-8000-000000000001';

  await prisma.user.upsert({
    where: { id: defaultUserId },
    create: {
      id: defaultUserId,
      email: 'demo@recipe.local',
      displayName: 'Demo',
    },
    update: {},
  });

  const slugToId = new Map<string, string>();

  async function retireIngredientSlug(slug: string, migrateToSlug?: string) {
    const retired = await prisma.ingredient.findUnique({ where: { slug } });
    if (!retired) return;
    if (migrateToSlug) {
      const target = await prisma.ingredient.findUnique({ where: { slug: migrateToSlug } });
      if (target) {
        await prisma.pantryItem.updateMany({
          where: { ingredientId: retired.id },
          data: { ingredientId: target.id },
        });
        await prisma.shoppingListItem.updateMany({
          where: { ingredientId: retired.id },
          data: { ingredientId: target.id },
        });
      }
    }
    await prisma.pantryItem.deleteMany({ where: { ingredientId: retired.id } });
    await prisma.recipeIngredient.deleteMany({ where: { ingredientId: retired.id } });
    await prisma.shoppingListItem.deleteMany({ where: { ingredientId: retired.id } });
    await prisma.ingredientAlias.deleteMany({ where: { ingredientId: retired.id } });
    await prisma.ingredient.delete({ where: { id: retired.id } });
  }

  for (const ing of ingredients) {
    const row = await prisma.ingredient.upsert({
      where: { slug: ing.slug },
      create: {
        slug: ing.slug,
        nameRu: ing.nameRu,
        category: ing.category,
      },
      update: { nameRu: ing.nameRu, category: ing.category },
    });
    slugToId.set(ing.slug, row.id);
    for (const alias of ing.aliases) {
      const normalized = alias.toLowerCase().trim();
      if (!normalized) continue;
      await prisma.ingredientAlias.upsert({
        where: { alias: normalized },
        create: { alias: normalized, ingredientId: row.id },
        update: { ingredientId: row.id },
      });
    }
  }

  await retireIngredientSlug('belyy-hleb-3-lomtik', 'hleb');
  await retireIngredientSlug('hleb-belyy', 'hleb');
  await retireIngredientSlug('hleb-belyy-kruglyy', 'hleb');
  await retireIngredientSlug('yaytsa-kurinye-belki', 'yaichnye-belki');
  await retireIngredientSlug('yaytsa-kurinye-krupnye', 'yaytsa');
  await retireIngredientSlug('yaytsa-kurinye-svarennye-vkrutuyu', 'yaytsa-kurinye-varenye');
  await retireIngredientSlug('yaytso-kurinoe', 'yaytsa');
  await retireIngredientSlug('kurinoe-yaytso', 'yaytsa');
  await retireIngredientSlug('hleb-tselnozernovoy-4-lomtik');
  await retireIngredientSlug('hmeli');
  await retireIngredientSlug('chay-chernyy');
  await retireIngredientSlug('chay-chernyy-krepkiy');
  await retireIngredientSlug('shalfey-1-puchok');
  await retireIngredientSlug('shnitt');
  await retireIngredientSlug('yaichnye-zheltki-varenye');
  await retireIngredientSlug('tonko-narezannoe-salo-s-myasnymi-prosloykami');
  await retireIngredientSlug('tonko-narezannoe-salo-s-myasnoy-prosloykoy');
  await retireIngredientSlug('tonko-narezannaya-parmskaya-vetchina');
  await retireIngredientSlug('sok-tomatnyy', 'tomatnyy-sok');
  await retireIngredientSlug('solenye-ogurtsy', 'ogurtsy-solenye');
  await retireIngredientSlug('stebel-limonnogo-sorgo');
  await retireIngredientSlug('melkiy-saharnyy-pesok', 'sahar');
  await retireIngredientSlug('maslo-oliv', 'maslo-olivkovoe');
  await retireIngredientSlug('olivkovoe-maslo-extra-virgin', 'maslo-olivkovoe');
  await retireIngredientSlug('salatnaya-smes-po-zhelaniyu', 'salatnyy-miks');
  await retireIngredientSlug('pomidor-1-sht', 'pomidor');
  await retireIngredientSlug('sol-i-chernyy-molotyy-perets');
  await retireIngredientSlug('kashtany');
  await retireIngredientSlug('mindalnye-lepestki');
  await retireIngredientSlug('maslo-vinogradnyh-kostochek');
  await retireIngredientSlug('maslo-gretskogo-oreha');
  await retireIngredientSlug('maslo-kunzhutnoe-temnoe');
  await retireIngredientSlug('kurinoe-bedro', 'kuritsa-bedro');
  await retireIngredientSlug('kuritsa-file', 'kuritsa-grudka');
  await retireIngredientSlug('farsh', 'farsh-smeshannyy');
  await retireIngredientSlug('armyanskiy-lavash-1-list', 'lavash');
  await retireIngredientSlug('armyanskiy-lavash-05-list', 'lavash');
  await retireIngredientSlug('armyanskiy-lavash-2-list', 'lavash');
  await retireIngredientSlug('armyanskiy-lavash-1-sht', 'lavash');
  await retireIngredientSlug('moskovskiy-provansal-ot-brenda-ya-lyublyu-gotovi', 'mayonez');

  const seedSlugs = new Set(ingredients.map((ing) => ing.slug));
  await pruneIngredientsAbsentFromSeedFile(seedSlugs, retireIngredientSlug);

  slugToId.clear();
  for (const row of await prisma.ingredient.findMany({
    select: { id: true, slug: true },
  })) {
    slugToId.set(row.slug, row.id);
  }

  const existingCount = await prisma.recipe.count();
  if (existingCount === 0) {
    for (const recipe of recipes) {
      const ingredientCreates = buildIngredientCreates(recipe, slugToId);

      await prisma.recipe.create({
        data: {
          title: recipe.title,
          description: recipe.description ?? null,
          instructions: recipe.steps,
          servings: recipe.servings,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          imageUrl: recipe.imageUrl ?? null,
          sourceUrl: recipe.sourceUrl,
          source: RecipeSource.seed,
          tags: recipe.tags,
          ingredients: { create: ingredientCreates },
        },
      });
    }
  } else {
    await pruneSeedRecipesAbsentFromFile(recipes);
    await pruneExtraSeedSourceUrlRows(recipes);
    await syncSeedRecipes(recipes, slugToId);
  }

  console.log(
    `Seed done: ${ingredients.length} ingredients, ${recipes.length} recipes in seed file.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
