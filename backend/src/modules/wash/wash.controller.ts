import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { WashService } from './wash.service';

class CreateBatchDto {
  @IsString()
  @IsNotEmpty()
  cleanerId: string;

  @IsString()
  @IsNotEmpty()
  detergent: string;
}

class ScanDto {
  @IsString()
  @IsNotEmpty()
  boxCode: string;
}

@Controller('wash-batches')
export class WashController {
  constructor(private readonly wash: WashService) {}

  @Post()
  create(@Body() dto: CreateBatchDto) {
    return this.wash.create(dto);
  }

  @Get()
  list() {
    return this.wash.list();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.wash.detail(id);
  }

  @Post(':id/scan')
  scan(@Param('id') id: string, @Body() dto: ScanDto) {
    return this.wash.scan(id, dto.boxCode);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.wash.complete(id);
  }
}
