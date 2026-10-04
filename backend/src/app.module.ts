import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SeedService } from './seed.service';
import { FlowService } from './flow.service';
import { FlowController } from './flow.controller';

@Module({
  controllers: [FlowController],
  providers: [PrismaService, SeedService, FlowService],
})
export class AppModule {}
