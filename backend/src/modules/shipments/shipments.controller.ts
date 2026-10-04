import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';

class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  toStoreCode: string;

  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  boxCodes: string[];
}

class BoxCodeDto {
  @IsString()
  @IsNotEmpty()
  boxCode: string;
}

class RejectDto extends BoxCodeDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Post()
  create(@Body() dto: CreateShipmentDto) {
    return this.shipments.create(dto);
  }

  @Get()
  list() {
    return this.shipments.list();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.shipments.detail(id);
  }

  @Post(':id/sign')
  sign(@Param('id') id: string, @Body() dto: BoxCodeDto) {
    return this.shipments.sign(id, dto.boxCode);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectDto) {
    return this.shipments.reject(id, dto.boxCode, dto.reason);
  }
}
