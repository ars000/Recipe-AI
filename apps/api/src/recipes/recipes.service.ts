import { Injectable, NotFoundException } from '@nestjs/common';
import {
  catalogEntryMatchesSourceName,
  decodeRecipeTextEntities,
  findCatalogSlugBySourceName,
  matchRecipes,
  mergePantryWithAtHome,
  normalizeRecipeTags,
  type RecipeForMatch,
} from '@recipe-manager/shared';
import { Prisma, RecipeSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type RecipeWithIngs = {
  id: string;
  title: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Array<{
    ingredientId: string;
    amount: number | null;
    unit: string | null;
    optional: boolean;
    group: string | null;
    ingredient: { nameRu: string };
  }>;
};

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  private withNormalizedTags<
    T extends {
      title: string;
      tags: string[];
      prepMinutes: number | null;
      cookMinutes: number | null;
    },
  >(recipe: T): T {
    return {
      ...recipe,
      tags: normalizeRecipeTags(
        recipe.title,
        recipe.tags,
        recipe.prepMinutes,
        recipe.cookMinutes,
      ),
    };
  }

  private withDecodedText<
    T extends {
      description?: string | null;
      instructions?: unknown;
    },
  >(recipe: T): T {
    const description = recipe.description?.trim()
      ? decodeRecipeTextEntities(recipe.description)
      : recipe.description;
    let instructions = recipe.instructions;
    if (Array.isArray(instructions)) {
      instructions = instructions.map((step) =>
        typeof step === 'string' ? decodeRecipeTextEntities(step) : step,
      );
    }
    return { ...recipe, description, instructions };
  }

  private presentRecipe<
    T extends {
      title: string;
      tags: string[];
      prepMinutes: number | null;
      cookMinutes: number | null;
      description?: string | null;
      instructions?: unknown;
    },
  >(recipe: T): T {
    return this.withDecodedText(this.withNormalizedTags(recipe));
  }

  private async resolveIngredientIdByName(
    name: string,
  ): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const direct = await this.prisma.ingredient.findFirst({
      where: {
        OR: [
          { nameRu: { equals: trimmed, mode: 'insensitive' } },
          {
            aliases: {
              some: { alias: { equals: trimmed, mode: 'insensitive' } },
            },
          },
        ],
      },
      include: { aliases: true },
    });
    if (direct) return direct.id;

    const catalog = await this.prisma.ingredient.findMany({
      include: { aliases: true },
    });
    const refs = catalog.map((row) => ({
      slug: row.slug,
      nameRu: row.nameRu,
      aliases: row.aliases.map((a) => a.alias),
    }));
    const slug = findCatalogSlugBySourceName(trimmed, refs);
    if (slug) {
      const match = catalog.find((row) => row.slug === slug);
      if (match) return match.id;
    }

    for (const row of catalog) {
      if (
        catalogEntryMatchesSourceName(
          {
            slug: row.slug,
            nameRu: row.nameRu,
            aliases: row.aliases.map((a) => a.alias),
          },
          trimmed,
        )
      ) {
        return row.id;
      }
    }
    return null;
  }

  private mapRecipeForMatch(recipe: RecipeWithIngs): RecipeForMatch {
    return {
      id: recipe.id,
      title: recipe.title,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      ingredients: recipe.ingredients.map((ri) => ({
        ingredientId: ri.ingredientId,
        nameRu: ri.ingredient.nameRu,
        amount: ri.amount,
        unit: ri.unit,
        optional: ri.optional,
        group: ri.group,
      })),
    };
  }

  private loadRecipeWithIngredients(where: Prisma.RecipeWhereInput) {
    return this.prisma.recipe.findMany({
      where,
      include: {
        ingredients: { include: { ingredient: true } },
      },
    });
  }

  async findMatched(
    explicitPantryIds: string[],
    defaultAtHomeIds: string[],
    limit = 50,
  ) {
    if (explicitPantryIds.length === 0) {
      return [];
    }
    const effectivePantry = mergePantryWithAtHome(
      explicitPantryIds,
      defaultAtHomeIds,
    );
    const recipes = await this.loadRecipeWithIngredients({});
    const forMatch = recipes.map((r) => this.mapRecipeForMatch(r));
    const matched = matchRecipes(forMatch, effectivePantry, {
      explicitPantryIds,
      defaultAtHomeIds,
    })
      .filter((m) => m.matchedCount > 0)
      .slice(0, limit);

    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    return matched.map((m) => {
      const full = recipeMap.get(m.recipeId)!;
      const presented = this.presentRecipe(full);
      return {
        ...m,
        description: presented.description,
        imageUrl: full.imageUrl,
        sourceUrl: full.sourceUrl,
        source: full.source,
        tags: presented.tags,
        servings: full.servings,
      };
    });
  }

  async findAll(limit = 100) {
    const rows = await this.prisma.recipe.findMany({
      take: limit,
      orderBy: { title: 'asc' },
      include: {
        ingredients: { include: { ingredient: true } },
      },
    });
    return rows.map((r) => this.presentRecipe(r));
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: { include: { ingredient: true } },
      },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    return this.presentRecipe(recipe);
  }

  async createFromDto(
    userId: string,
    data: {
      title: string;
      description?: string;
      instructions: string[];
      servings?: number;
      prepMinutes?: number;
      cookMinutes?: number;
      sourceUrl?: string;
      source?: RecipeSource;
      tags?: string[];
      ingredients: Array<{
        ingredientId?: string;
        name?: string;
        amount?: number;
        unit?: string;
        optional?: boolean;
      }>;
    },
  ) {
    const ingredientRows: Prisma.RecipeIngredientCreateManyRecipeInput[] = [];
    for (const ing of data.ingredients) {
      let ingredientId = ing.ingredientId;
      if (!ingredientId && ing.name) {
        const resolvedId = await this.resolveIngredientIdByName(ing.name);
        if (resolvedId) ingredientId = resolvedId;
        else {
          const slug = ing.name.toLowerCase().replace(/\s+/g, '-');
          const created = await this.prisma.ingredient.create({
            data: {
              slug: `${slug}-${Date.now()}`,
              nameRu: ing.name,
              category: 'прочее',
            },
          });
          ingredientId = created.id;
        }
      }
      if (!ingredientId) continue;
      ingredientRows.push({
        ingredientId,
        amount: ing.amount,
        unit: ing.unit,
        optional: ing.optional ?? false,
      });
    }

    return this.prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        servings: data.servings,
        prepMinutes: data.prepMinutes,
        cookMinutes: data.cookMinutes,
        sourceUrl: data.sourceUrl,
        source: data.source ?? 'user',
        tags: data.tags ?? [],
        ingredients: { create: ingredientRows },
      },
      include: { ingredients: { include: { ingredient: true } } },
    });
  }

  async saveForUser(userId: string, recipeId: string) {
    await this.findOne(recipeId);
    return this.prisma.savedRecipe.upsert({
      where: { userId_recipeId: { userId, recipeId } },
      create: { userId, recipeId },
      update: {},
    });
  }

  async listSaved(userId: string) {
    const saved = await this.prisma.savedRecipe.findMany({
      where: { userId },
      include: {
        recipe: {
          include: { ingredients: { include: { ingredient: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return saved.map((s) => this.presentRecipe(s.recipe));
  }

  async unsave(userId: string, recipeId: string) {
    await this.prisma.savedRecipe.deleteMany({ where: { userId, recipeId } });
    return { ok: true };
  }
}
