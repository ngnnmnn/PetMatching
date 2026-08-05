import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';
import { MergeWishlistDto } from './dto/merge-wishlist.dto';
import { WishlistService } from './wishlist.service';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@Controller('api/wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getWishlist(@Req() req: AuthenticatedRequest) {
    return this.wishlistService.getWishlist(req.user.id);
  }

  @Post('toggle')
  toggleWishlist(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ToggleWishlistDto,
  ) {
    return this.wishlistService.toggleWishlist(req.user.id, dto.productId);
  }

  @Post('merge')
  mergeWishlist(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MergeWishlistDto,
  ) {
    return this.wishlistService.mergeWishlist(req.user.id, dto.productIds);
  }
}
