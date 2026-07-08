import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@Controller('api/cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.getCart(req.user.id);
  }

  @Post()
  addToCart(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCart(req.user.id, dto.productId, dto.quantity);
  }

  @Post('merge')
  mergeCart(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MergeCartDto,
  ) {
    return this.cartService.mergeCart(req.user.id, dto.items);
  }

  @Patch(':productId')
  updateQuantity(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartDto,
  ) {
    return this.cartService.updateQuantity(req.user.id, productId, dto.quantity);
  }

  @Delete(':productId')
  removeFromCart(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeFromCart(req.user.id, productId);
  }

  @Delete()
  clearCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.clearCart(req.user.id);
  }
}
