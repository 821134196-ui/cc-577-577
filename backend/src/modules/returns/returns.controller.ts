import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ReturnsService } from './returns.service';

class CreateReturnDto {
  @IsString()
  @IsNotEmpty()
  storeCode: string;

  @IsString()
  @IsNotEmpty()
  boxCode: string;

  @IsString()
  @IsIn(['GOOD', 'CRACKED', 'DIRTY'])
  condition: string;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  create(@Body() dto: CreateReturnDto) {
    return this.returns.create(dto);
  }

  @Get()
  list() {
    return this.returns.list();
  }
}
