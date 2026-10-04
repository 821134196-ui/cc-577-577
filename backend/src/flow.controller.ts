import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { FlowService } from './flow.service';
import { SeedService } from './seed.service';

@Controller('api')
export class FlowController {
  constructor(
    private flow: FlowService,
    private seed: SeedService,
  ) {}

  @Get('meta')
  meta() {
    return this.flow.meta();
  }

  // 重置演示数据（仅本地演示用）
  @Post('admin/reset')
  reset() {
    return this.seed.seed().then(() => ({ ok: true, message: '演示数据已重置' }));
  }

  // ---- 箱子 ----
  @Post('boxes')
  createBox(@Body() dto: { code: string; spec?: string }) {
    return this.flow.createBox(dto.code, dto.spec);
  }

  @Get('boxes')
  listBoxes(@Query('code') code?: string, @Query('status') status?: string) {
    return this.flow.listBoxes({ code, status });
  }

  @Get('boxes/:id')
  boxDetail(@Param('id', ParseIntPipe) id: number) {
    return this.flow.boxDetail(id);
  }

  @Get('boxes/:id/trail')
  trail(@Param('id', ParseIntPipe) id: number) {
    return this.flow.locationTrail(id);
  }

  // ---- 回收 ----
  @Post('returns')
  registerReturn(@Body() dto: { boxCode: string; storeCode: string; condition: string; note?: string }) {
    return this.flow.registerReturn(dto);
  }

  // ---- 清洗批次 ----
  @Post('wash-batches')
  createBatch(@Body() dto: { washerCode: string; detergent?: string }) {
    return this.flow.createBatch(dto);
  }

  @Post('wash-batches/:id/scan')
  scan(@Param('id', ParseIntPipe) id: number, @Body() dto: { boxCode: string }) {
    return this.flow.scanIntoBatch(id, dto.boxCode);
  }

  @Post('wash-batches/:id/finish')
  finish(@Param('id', ParseIntPipe) id: number) {
    return this.flow.finishBatch(id);
  }

  @Get('wash-batches')
  batches() {
    return this.flow.listBatches();
  }

  // ---- 质检 ----
  @Post('inspections')
  inspect(
    @Body()
    dto: {
      batchId: number;
      boxCode: string;
      inspectorCode: string;
      residueFree: boolean;
      dry: boolean;
      intact: boolean;
      note?: string;
    },
  ) {
    return this.flow.inspect(dto);
  }

  // ---- 出库 / 交接 ----
  @Post('handovers')
  createHandover(@Body() dto: { boxCode: string; targetStoreCode: string; driverCode: string }) {
    return this.flow.createHandover(dto);
  }

  @Get('handovers')
  handovers(@Query('status') status?: string) {
    return this.flow.listHandovers(status);
  }

  @Post('handovers/:id/sign')
  sign(@Param('id', ParseIntPipe) id: number) {
    return this.flow.signHandover(id);
  }

  @Post('handovers/:id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: { reason: string }) {
    return this.flow.rejectHandover(id, dto.reason);
  }

  // ---- 异常去向 / 通知 ----
  @Get('dispositions')
  dispositions() {
    return this.flow.listDispositions();
  }

  @Get('notifications')
  notifications() {
    return this.flow.listNotifications();
  }

  @Post('notifications/:id/read')
  readNotification(@Param('id', ParseIntPipe) id: number) {
    return this.flow.markNotificationRead(id);
  }
}
