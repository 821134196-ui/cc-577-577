import { Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('stores')
  stores() {
    return this.catalog.stores();
  }

  @Get('users')
  users(@Query('role') role?: string) {
    return this.catalog.users(role);
  }

  @Get('dashboard')
  dashboard() {
    return this.catalog.dashboard();
  }
}
