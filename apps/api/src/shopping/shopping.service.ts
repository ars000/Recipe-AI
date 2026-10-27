import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  dedupeMissingByIngredient,
  matchRecipes,
  mergeShoppingLine,
  recipeIngredientDisplayName,
  recipeIngredientShoppingCustomName,
  type ShoppingLineInput,
} from '@recipe-manager/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RecipesService } from '../recipes/recipes.service';
import { PantryService } from '../pantry/pantry.service';

type RecipeSourceInput = {
  recipeId: string;
  amount: number | null;
  unit: string | null;
};

type ListItemRow = {
  id: string;
  checked: boolean;
  ingredientId: string | null;
  customName: string | null;
  amount: number | null;
  unit: string | null;
};

const listItemsInclude = {
  ingredient: true,
  sources: {
    include: {
      recipe: { select: { id: true, title: true } },
    },
  },
} as const;

@Injectable()
export class ShoppingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipes: RecipesService,
    private readonly pantry: PantryService,
  ) {}

  async getOrCreateDefaultList(
    userId: string,
    options?: { skipRepair?: boolean },
  ) {
    let list = await this.fetchUserList(userId);
    if (!list) {
      list = await this.prisma.shoppingList.create({
        data: { userId, name: 'Список покупок' },
        include: {
          items: { include: listItemsInclude, orderBy: { checked: 'asc' } },
        },
      });
    }
    if (!options?.skipRepair && this.hasOrphanSources(list)) {
      try {
        await this.repairOrphanSources(userId, list);
        list = (await this.fetchUserList(userId))!;
      } catch {
        // Список всё равно отдаём, даже если восстановление ссылок не удалось
      }
    }
    return list;
  }

  private fetchUserList(userId: string) {
    return this.prisma.shoppingList.findFirst({
      where: { userId },
      include: {
        items: { include: listItemsInclude, orderBy: { checked: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private fetchListById(listId: string) {
    return this.prisma.shoppingList.findUnique({
      where: { id: listId },
      include: {
        items: { include: listItemsInclude, orderBy: { checked: 'asc' } },
      },
    });
  }

  private hasOrphanSources(
    list: NonNullable<Awaited<ReturnType<ShoppingService['fetchUserList']>>>,
  ) {
    return list.items.some(
      (i) => i.ingredientId != null && i.sources.length === 0,
    );
  }

  private async repairOrphanSources(
    userId: string,
    list: NonNullable<Awaited<ReturnType<ShoppingService['fetchUserList']>>>,
  ) {
    const recipeIds = await this.collectCandidateRecipeIds(userId, list);
    if (recipeIds.length === 0) return;

    const ingredients = await this.prisma.recipeIngredient.findMany({
      where: {
        recipeId: { in: recipeIds },
        ingredientId: {
          in: list.items
            .filter((i) => i.ingredientId && i.sources.length === 0)
            .map((i) => i.ingredientId!),
        },
      },
    });

    for (const item of list.items) {
      if (!item.ingredientId || item.sources.length > 0) continue;
      for (const ri of ingredients.filter(
        (row) => row.ingredientId === item.ingredientId,
      )) {
        await this.attachRecipeSource(item.id, item.ingredientId, {
          recipeId: ri.recipeId,
          amount: ri.amount,
          unit: ri.unit,
        });
      }
    }
  }

  private async collectCandidateRecipeIds(
    userId: string,
    list: NonNullable<Awaited<ReturnType<ShoppingService['fetchUserList']>>>,
  ) {
    const [saved, meals] = await Promise.all([
      this.prisma.savedRecipe.findMany({
        where: { userId },
        select: { recipeId: true },
      }),
      this.prisma.mealPlan.findMany({
        where: { userId },
        select: { recipeId: true },
      }),
    ]);

    const ids = new Set<string>([
      ...saved.map((s) => s.recipeId),
      ...meals.map((m) => m.recipeId),
      ...list.items.flatMap((i) => i.sources.map((s) => s.recipeId)),
    ]);

    return [...ids];
  }

  private toLineInput(item: ListItemRow): ShoppingLineInput {
    return {
      ingredientId: item.ingredientId,
      customName: item.customName,
      amount: item.amount,
      unit: item.unit,
    };
  }

  private async attachRecipeSource(
    itemId: string,
    ingredientId: string,
    source: RecipeSourceInput,
  ) {
    const existing = await this.prisma.shoppingListItemSource.findUnique({
      where: {
        itemId_recipeId: { itemId, recipeId: source.recipeId },
      },
    });

    if (existing) {
      const merged = mergeShoppingLine(
        {
          ingredientId,
          amount: existing.amount,
          unit: existing.unit,
        },
        {
          ingredientId,
          amount: source.amount,
          unit: source.unit,
        },
      );
      if (merged) {
        await this.prisma.shoppingListItemSource.update({
          where: { id: existing.id },
          data: { amount: merged.amount, unit: merged.unit },
        });
      }
      return;
    }

    await this.prisma.shoppingListItemSource.create({
      data: {
        itemId,
        recipeId: source.recipeId,
        amount: source.amount ?? undefined,
        unit: source.unit ?? undefined,
      },
    });
  }

  private async upsertLine(
    listId: string,
    unchecked: ListItemRow[],
    incoming: ShoppingLineInput & {
      ingredientId?: string;
      customName?: string;
    },
    recipeSource?: RecipeSourceInput,
  ) {
    const mergeTarget = unchecked.find(
      (row) => mergeShoppingLine(this.toLineInput(row), incoming) !== null,
    );

    let itemId: string;

    if (mergeTarget) {
      const merged = mergeShoppingLine(this.toLineInput(mergeTarget), incoming);
      if (merged) {
        await this.prisma.shoppingListItem.update({
          where: { id: mergeTarget.id },
          data: {
            amount: merged.amount,
            unit: merged.unit,
            ...(incoming.customName && !mergeTarget.customName
              ? { customName: incoming.customName }
              : {}),
          },
        });
        itemId = mergeTarget.id;
      } else {
        const created = await this.prisma.shoppingListItem.create({
          data: {
            listId,
            ingredientId: incoming.ingredientId ?? undefined,
            customName: incoming.customName ?? undefined,
            amount: incoming.amount ?? undefined,
            unit: incoming.unit ?? undefined,
          },
        });
        itemId = created.id;
      }
    } else {
      const created = await this.prisma.shoppingListItem.create({
        data: {
          listId,
          ingredientId: incoming.ingredientId ?? undefined,
          customName: incoming.customName ?? undefined,
          amount: incoming.amount ?? undefined,
          unit: incoming.unit ?? undefined,
        },
      });
      itemId = created.id;
    }

    if (recipeSource && incoming.ingredientId) {
      await this.attachRecipeSource(
        itemId,
        incoming.ingredientId,
        recipeSource,
      );
    }
  }

  async addFromRecipe(userId: string, recipeId: string) {
    const recipe = await this.recipes.findOne(recipeId);
    const effectiveIds = await this.pantry.getEffectivePantryIds(userId);
    const pantryIds = new Set(effectiveIds);
    const [match] = matchRecipes(
      [
        {
          id: recipe.id,
          title: recipe.title,
          ingredients: recipe.ingredients.map((ri) => ({
            ingredientId: ri.ingredientId,
            nameRu: recipeIngredientDisplayName(
              ri.labelRu,
              ri.ingredient.nameRu,
            ),
            optional: ri.optional,
            amount: ri.amount,
            unit: ri.unit,
          })),
        },
      ],
      pantryIds,
    );
    let list = await this.getOrCreateDefaultList(userId, { skipRepair: true });

    const missing = dedupeMissingByIngredient(match?.missing ?? []);

    for (const m of missing) {
      const row = recipe.ingredients.find(
        (ri) => ri.ingredientId === m.ingredientId,
      );
      const customName = row
        ? recipeIngredientShoppingCustomName(row.labelRu, row.ingredient.nameRu)
        : undefined;
      const unchecked = list.items.filter((i) => !i.checked);
      await this.upsertLine(
        list.id,
        unchecked,
        {
          ingredientId: m.ingredientId,
          customName,
          amount: m.amount ?? null,
          unit: m.unit ?? null,
        },
        {
          recipeId: recipe.id,
          amount: m.amount ?? null,
          unit: m.unit ?? null,
        },
      );
      const refreshed = await this.fetchListById(list.id);
      if (refreshed) list = refreshed;
    }

    return this.getOrCreateDefaultList(userId);
  }

  async toggleItem(userId: string, itemId: string, checked: boolean) {
    const list = await this.getOrCreateDefaultList(userId);
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Item not found');
    return this.prisma.shoppingListItem.update({
      where: { id: itemId },
      data: { checked },
    });
  }

  async removeItem(userId: string, itemId: string) {
    const list = await this.getOrCreateDefaultList(userId);
    const item = list.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Item not found');
    await this.prisma.shoppingListItem.delete({ where: { id: itemId } });
    return this.getOrCreateDefaultList(userId);
  }

  async addCustom(
    userId: string,
    data: { name: string; amount?: number; unit?: string },
  ) {
    const list = await this.getOrCreateDefaultList(userId);
    const unchecked = list.items.filter((i) => !i.checked);
    await this.upsertLine(list.id, unchecked, {
      customName: data.name,
      amount: data.amount ?? null,
      unit: data.unit ?? null,
    });
    return this.getOrCreateDefaultList(userId);
  }

  async clearChecked(userId: string) {
    const list = await this.getOrCreateDefaultList(userId);
    await this.prisma.shoppingListItem.deleteMany({
      where: { listId: list.id, checked: true },
    });
    return this.getOrCreateDefaultList(userId);
  }

  async clearAll(userId: string) {
    const list = await this.getOrCreateDefaultList(userId);
    await this.prisma.shoppingListItem.deleteMany({
      where: { listId: list.id },
    });
    return this.getOrCreateDefaultList(userId);
  }

  private buildSharePayload(
    list: Awaited<ReturnType<ShoppingService['getOrCreateDefaultList']>>,
  ) {
    const items = list.items.map((i) => ({
      name: i.customName ?? i.ingredient?.nameRu ?? '—',
      amount: i.amount,
      unit: i.unit,
      recipes: i.sources.map((s) => s.recipe.title),
    }));
    return {
      listName: list.name,
      sharedAt: new Date().toISOString(),
      items,
    };
  }

  async createShare(userId: string) {
    const list = await this.getOrCreateDefaultList(userId);
    const payload = this.buildSharePayload(list);
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.shoppingListShare.create({
      data: {
        token,
        userId,
        payload,
        expiresAt,
      },
    });
    return { token, expiresAt: expiresAt.toISOString(), payload };
  }

  async getShareByToken(token: string) {
    const share = await this.prisma.shoppingListShare.findUnique({
      where: { token },
    });
    if (!share || share.expiresAt < new Date()) {
      throw new NotFoundException('Share not found or expired');
    }
    return share.payload;
  }
}
