import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { GetProductsDto } from './dto/get-products.dto';
import { ProductsService } from './products.service';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  getProducts(@Query() dto: GetProductsDto) {
    return this.productsService.getProducts(dto);
  }

  @Get('featured')
  getFeatured() {
    return this.productsService.getFeaturedProducts();
  }

  @Get('categories')
  getCategories() {
    return this.productsService.getCategories();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  @Get(':productId/reviews')
  getReviews(@Param('productId') productId: string) {
    return this.productsService.getReviews(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':productId/can-review')
  canReview(@Req() req: any, @Param('productId') productId: string) {
    return this.productsService.canReview(req.user.id, productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':productId/reviews')
  createReview(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: { rating: number; comment?: string; images?: string[] },
  ) {
    return this.productsService.createReview(req.user.id, productId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('reviews/:id')
  updateReview(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: { rating: number; comment?: string; images?: string[] },
  ) {
    return this.productsService.updateReview(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reviews/:id')
  deleteReview(@Req() req: any, @Param('id') id: string) {
    return this.productsService.deleteReview(req.user.id, id);
  }
}
