import { Body, Controller, Post } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

class GenerateRecipeDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pantryIngredientIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pantryNames?: string[];

  @IsOptional()
  @IsString()
  constraints?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

class RecognizeDto {
  @IsString()
  imageUrl!: string;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('generate-recipe')
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  async generate(@Body() dto: GenerateRecipeDto) {
    let names = dto.pantryNames ?? [];
    if (dto.pantryIngredientIds?.length) {
      const ings = await this.prisma.ingredient.findMany({
        where: { id: { in: dto.pantryIngredientIds } },
      });
      names = ings.map((i) => i.nameRu);
    }
    return this.aiService.generateRecipe({
      pantryNames: names,
      constraints: dto.constraints,
      locale: dto.locale,
    });
  }

  @Post('recognize-products')
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  recognize(@Body() dto: RecognizeDto) {
    return this.aiService.recognizeProducts(dto.imageUrl);
  }
}
