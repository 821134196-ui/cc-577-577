import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CatalogController } from './modules/catalog/catalog.controller';
import { CatalogService } from './modules/catalog/catalog.service';
import { BoxesController } from './modules/boxes/boxes.controller';
import { BoxesService } from './modules/boxes/boxes.service';
import { ReturnsController } from './modules/returns/returns.controller';
import { ReturnsService } from './modules/returns/returns.service';
import { WashController } from './modules/wash/wash.controller';
import { WashService } from './modules/wash/wash.service';
import { QcController } from './modules/qc/qc.controller';
import { QcService } from './modules/qc/qc.service';
import { ShipmentsController } from './modules/shipments/shipments.controller';
import { ShipmentsService } from './modules/shipments/shipments.service';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { NotificationsService } from './modules/notifications/notifications.service';

@Module({
  controllers: [
    CatalogController,
    BoxesController,
    ReturnsController,
    WashController,
    QcController,
    ShipmentsController,
    NotificationsController,
  ],
  providers: [
    PrismaService,
    CatalogService,
    BoxesService,
    ReturnsService,
    WashService,
    QcService,
    ShipmentsService,
    NotificationsService,
  ],
})
export class AppModule {}
