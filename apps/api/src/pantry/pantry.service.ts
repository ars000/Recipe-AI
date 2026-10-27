import { Injectable } from '@nestjs/common';
import {
  DEFAULT_AT_HOME_INGREDIENT_SLUGS,
  mergePantryWithAtHome,
} from '@recipe-manager/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PantryService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultAtHomeIngredientIds(): Promise<string[]> {
    const rows = await this.prisma.ingredient.findMany({
      where: { slug: { in: [...DEFAULT_AT_HOME_INGREDIENT_SLUGS] } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async getEffectivePantryIds(userId: string): Promise<string[]> {
    const [pantry, atHome] = await Promise.all([
      this.getPantry(userId),
      this.getDefaultAtHomeIngredientIds(),
    ]);
    return [
      ...mergePantryWithAtHome(
        pantry.map((p) => p.ingredientId),
        atHome,
      ),
    ];
  }

  async getPantry(userId: string) {
    return this.prisma.pantryItem.findMany({
      where: { userId },
      include: { ingredient: true },
      orderBy: { ingredient: { nameRu: 'asc' } },
    });
  }

  async replacePantry(userId: string, ingredientIds: string[]) {
    const unique = [...new Set(ingredientIds)];
    const existing = await this.prisma.ingredient.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    const validIds = existing.map((row) => row.id);
    await this.prisma.$transaction([
      this.prisma.pantryItem.deleteMany({ where: { userId } }),
      ...(validIds.length
        ? [
            this.prisma.pantryItem.createMany({
              data: validIds.map((ingredientId) => ({ userId, ingredientId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    return this.getPantry(userId);
  }
}
