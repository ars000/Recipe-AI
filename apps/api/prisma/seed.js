"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = require("path");
const prisma = new client_1.PrismaClient();
async function main() {
    const seedsDir = (0, path_1.join)(__dirname, 'seeds');
    const ingredients = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(seedsDir, 'ingredients.json'), 'utf8'));
    const recipes = JSON.parse((0, fs_1.readFileSync)((0, path_1.join)(seedsDir, 'recipes.seed.json'), 'utf8'));
    const defaultUserId = process.env.DEFAULT_USER_ID ?? '00000000-0000-4000-8000-000000000001';
    await prisma.user.upsert({
        where: { id: defaultUserId },
        create: {
            id: defaultUserId,
            email: 'demo@recipe.local',
            displayName: 'Demo',
        },
        update: {},
    });
    const slugToId = new Map();
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
            if (!normalized)
                continue;
            await prisma.ingredientAlias.upsert({
                where: { alias: normalized },
                create: { alias: normalized, ingredientId: row.id },
                update: { ingredientId: row.id },
            });
        }
    }
    const existingCount = await prisma.recipe.count();
    if (existingCount === 0) {
        for (const recipe of recipes) {
            const ingredientCreates = recipe.ingredients
                .map((ri) => {
                const ingredientId = slugToId.get(ri.slug);
                if (!ingredientId) {
                    console.warn(`Unknown slug ${ri.slug} in ${recipe.title}`);
                    return null;
                }
                return {
                    ingredientId,
                    amount: ri.amount,
                    unit: ri.unit,
                    optional: ri.optional ?? false,
                };
            })
                .filter(Boolean);
            await prisma.recipe.create({
                data: {
                    title: recipe.title,
                    description: `Домашний рецепт: ${recipe.title}.`,
                    instructions: recipe.steps,
                    servings: recipe.servings,
                    prepMinutes: recipe.prepMinutes,
                    cookMinutes: recipe.cookMinutes,
                    sourceUrl: recipe.sourceUrl,
                    source: client_1.RecipeSource.seed,
                    tags: recipe.tags,
                    ingredients: { create: ingredientCreates },
                },
            });
        }
    }
    console.log(`Seed done: ${ingredients.length} ingredients, ${recipes.length} recipes (if empty DB).`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map