import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsEnum, IsString, IsUUID } from 'class-validator';
import { MealType } from '@prisma/client';
import { CurrentUserId } from '../common/current-user.decorator';
import { MealPlanService } from './meal-plan.service';

class UpsertMealDto {
  @IsString()
  date!: string;

  @IsEnum(MealType)
  mealType!: MealType;

  @IsUUID()
  recipeId!: string;
}

@Controller('meal-plan')
export class MealPlanController {
  constructor(private readonly mealPlan: MealPlanService) {}

  @Get()
  range(
    @CurrentUserId() userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = from ?? new Date().toISOString().slice(0, 10);
    const end =
      to ?? new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
    return this.mealPlan.getRange(userId, start, end);
  }

  @Post()
  upsert(@CurrentUserId() userId: string, @Body() dto: UpsertMealDto) {
    return this.mealPlan.upsert(userId, dto.date, dto.mealType, dto.recipeId);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.mealPlan.remove(userId, id);
  }
}
