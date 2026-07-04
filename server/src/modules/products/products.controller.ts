import { Controller, Get, Param, Query } from '@nestjs/common';
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

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }
}
