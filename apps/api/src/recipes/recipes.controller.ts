import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecipeSource } from '@prisma/client';
import { CurrentUserId } from '../common/current-user.decorator';
import { PantryService } from '../pantry/pantry.service';
import { RecipesService } from './recipes.service';

class RecipeIngredientDto {
  @IsOptional()
  @IsUUID()
  ingredientId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  optional?: boolean;
}

class CreateRecipeDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  instructions!: string[];

  @IsOptional()
  @IsNumber()
  servings?: number;

  @IsOptional()
  @IsNumber()
  prepMinutes?: number;

  @IsOptional()
  @IsNumber()
  cookMinutes?: number;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsEnum(RecipeSource)
  source?: RecipeSource;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}

@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly pantryService: PantryService,
  ) {}

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query('match') match?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number(limit) : 50;
    if (match === 'pantry') {
      const [pantry, atHome] = await Promise.all([
        this.pantryService.getPantry(userId),
        this.pantryService.getDefaultAtHomeIngredientIds(),
      ]);
      const explicitIds = pantry.map((p) => p.ingredientId);
      return this.recipesService.findMatched(explicitIds, atHome, take);
    }
    return this.recipesService.findAll(take);
  }

  @Get('saved')
  saved(@CurrentUserId() userId: string) {
    return this.recipesService.listSaved(userId);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.recipesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRecipeDto) {
    return this.recipesService.createFromDto(process.env.DEFAULT_USER_ID!, dto);
  }

  @Post(':id/save')
  save(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.recipesService.saveForUser(userId, id);
  }

  @Delete(':id/save')
  unsave(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.recipesService.unsave(userId, id);
  }
}
