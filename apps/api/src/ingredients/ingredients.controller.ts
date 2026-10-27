import { Controller, Get, Query } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  list(@Query('q') q?: string, @Query('limit') limit?: string) {
    if (q !== undefined || limit !== undefined) {
      return this.ingredientsService.search(q, limit ? Number(limit) : 50);
    }
    return this.ingredientsService.findAll();
  }
}
