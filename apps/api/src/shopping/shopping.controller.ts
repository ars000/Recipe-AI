import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { CurrentUserId } from '../common/current-user.decorator';
import { ShoppingService } from './shopping.service';

class AddCustomDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

class ToggleDto {
  @IsBoolean()
  checked!: boolean;
}

@Controller('shopping-lists')
export class ShoppingController {
  constructor(private readonly shopping: ShoppingService) {}

  @Get()
  get(@CurrentUserId() userId: string) {
    return this.shopping.getOrCreateDefaultList(userId);
  }

  @Post('from-recipe/:recipeId')
  fromRecipe(
    @CurrentUserId() userId: string,
    @Param('recipeId') recipeId: string,
  ) {
    return this.shopping.addFromRecipe(userId, recipeId);
  }

  @Post('items')
  addItem(@CurrentUserId() userId: string, @Body() dto: AddCustomDto) {
    return this.shopping.addCustom(userId, dto);
  }

  @Patch('items/:itemId')
  toggle(
    @CurrentUserId() userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ToggleDto,
  ) {
    return this.shopping.toggleItem(userId, itemId, dto.checked);
  }

  @Delete('items/:itemId')
  removeItem(@CurrentUserId() userId: string, @Param('itemId') itemId: string) {
    return this.shopping.removeItem(userId, itemId);
  }

  @Post('clear-checked')
  clearChecked(@CurrentUserId() userId: string) {
    return this.shopping.clearChecked(userId);
  }

  @Post('clear')
  clearAll(@CurrentUserId() userId: string) {
    return this.shopping.clearAll(userId);
  }

  @Post('share')
  share(@CurrentUserId() userId: string) {
    return this.shopping.createShare(userId);
  }

  @Get('share/:token')
  getShare(@Param('token') token: string) {
    return this.shopping.getShareByToken(token);
  }
}
