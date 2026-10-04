import { Controller, Get, Param, Query } from '@nestjs/common';
import { BoxesService } from './boxes.service';

@Controller('boxes')
export class BoxesController {
  constructor(private readonly boxes: BoxesService) {}

  @Get()
  list(@Query('status') status?: string, @Query('q') q?: string) {
    return this.boxes.list(status, q);
  }

  @Get(':code')
  detail(@Param('code') code: string) {
    return this.boxes.detail(code);
  }
}
