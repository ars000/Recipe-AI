import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type IngredientRow = {
  id: string;
  slug: string;
  nameRu: string;
  category: string | null;
  aliases: { alias: string }[];
};

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapIngredient(row: IngredientRow) {
    return {
      id: row.id,
      slug: row.slug,
      nameRu: row.nameRu,
      category: row.category,
      aliases: row.aliases.map((a) => a.alias),
    };
  }

  search(q?: string, limit = 50) {
    const query = q?.trim();
    return this.prisma.ingredient
      .findMany({
        where: query
          ? {
              OR: [
                { nameRu: { contains: query, mode: 'insensitive' } },
                { slug: { contains: query, mode: 'insensitive' } },
                {
                  aliases: {
                    some: { alias: { contains: query, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : undefined,
        take: limit,
        orderBy: { nameRu: 'asc' },
        include: { aliases: true },
      })
      .then((rows) => rows.map((row) => this.mapIngredient(row)));
  }

  findAll(limit = 1200) {
    return this.prisma.ingredient
      .findMany({
        take: limit,
        orderBy: { nameRu: 'asc' },
        include: { aliases: true },
      })
      .then((rows) => rows.map((row) => this.mapIngredient(row)));
  }
}
