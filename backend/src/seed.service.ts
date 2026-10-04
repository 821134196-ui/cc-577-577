import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// 首次启动自动写入演示基础数据
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('Seed');

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.box.count();
    if (count > 0) return;
    await this.seed();
  }

  // 重置为演示初始数据
  async seed() {
    const order = [
      'appNotification',
      'locationEvent',
      'disposition',
      'handover',
      'inspection',
      'washRecord',
      'washBatch',
      'returnRecord',
      'box',
      'staff',
      'store',
    ] as const;
    for (const m of order) {
      // @ts-expect-error 动态模型名
      await this.prisma[m].deleteMany();
    }

    await this.prisma.store.createMany({
      data: [
        { code: 'S001', name: '中山公园店' },
        { code: 'S002', name: '陆家嘴店' },
        { code: 'S003', name: '徐家汇店' },
      ],
    });
    await this.prisma.staff.createMany({
      data: [
        // W01 兼岗清洗/质检：可以清洗，但系统禁止他质检自己的批次
        { code: 'W01', name: '王清洗(兼质检)', role: 'WASHER,INSPECTOR' },
        { code: 'W02', name: '刘冲洗', role: 'WASHER' },
        { code: 'Q01', name: '陈质检', role: 'INSPECTOR' },
        { code: 'D01', name: '赵配送', role: 'DRIVER' },
      ],
    });
    const stores = await this.prisma.store.findMany();
    const s1 = stores.find((s) => s.code === 'S001')!;
    const s2 = stores.find((s) => s.code === 'S002')!;
    await this.prisma.box.createMany({
      data: [
        { code: 'BX-1001', status: 'IN_USE', currentStoreId: s1.id, lastStoreId: s1.id },
        { code: 'BX-1002', status: 'IN_USE', currentStoreId: s1.id, lastStoreId: s1.id },
        { code: 'BX-1003', status: 'IN_USE', currentStoreId: s2.id, lastStoreId: s2.id },
        { code: 'BX-1004', status: 'IN_USE', currentStoreId: s2.id, lastStoreId: s2.id },
        { code: 'BX-1005', status: 'IN_USE', currentStoreId: s2.id, lastStoreId: s2.id },
      ],
    });
    this.logger.log('演示数据已写入：3 家门店、4 名员工、5 只保温箱');
  }
}
