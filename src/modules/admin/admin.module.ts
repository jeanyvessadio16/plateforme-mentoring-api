import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { ReportsController } from './reports.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  controllers: [AdminController, ReportsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
