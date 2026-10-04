import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { QcService } from './qc.service';

class InspectDto {
  @IsString()
  @IsNotEmpty()
  boxCode: string;

  @IsString()
  @IsNotEmpty()
  inspectorId: string;

  @IsBoolean()
  residueFree: boolean;

  @IsBoolean()
  dried: boolean;

  @IsOptional()
  @IsString()
  failReason?: string;

  @ValidateIf((o) => !(o.residueFree && o.dried))
  @IsString()
  @IsIn(['REWASH', 'REPAIR', 'SCRAP'])
  disposition?: string;
}

@Controller('qc')
export class QcController {
  constructor(private readonly qc: QcService) {}

  @Get('pending')
  pending() {
    return this.qc.pending();
  }

  @Get('records')
  records() {
    return this.qc.records();
  }

  @Post('inspect')
  inspect(@Body() dto: InspectDto) {
    return this.qc.inspect(dto);
  }
}
