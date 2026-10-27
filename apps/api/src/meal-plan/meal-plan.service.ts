import { Injectable } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MealPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async getRange(userId: string, from: string, to: string) {
    return this.prisma.mealPlan.findMany({
      where: {
        userId,
        date: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      include: {
        recipe: {
          include: { ingredients: { include: { ingredient: true } } },
        },
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    });
  }

  async upsert(
    userId: string,
    date: string,
    mealType: MealType,
    recipeId: string,
  ) {
    const day = new Date(date);
    return this.prisma.mealPlan.upsert({
      where: {
        userId_date_mealType: { userId, date: day, mealType },
      },
      create: { userId, date: day, mealType, recipeId },
      update: { recipeId },
      include: { recipe: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.prisma.mealPlan.deleteMany({ where: { id, userId } });
    return { ok: true };
  }
}
