import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsArray, IsUUID } from 'class-validator';
import { CurrentUserId } from '../common/current-user.decorator';
import { PantryService } from './pantry.service';

class ReplacePantryDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ingredientIds!: string[];
}

@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Get()
  get(@CurrentUserId() userId: string) {
    return this.pantryService.getPantry(userId);
  }

  @Put()
  replace(@CurrentUserId() userId: string, @Body() dto: ReplacePantryDto) {
    return this.pantryService.replacePantry(userId, dto.ingredientIds);
  }
}
