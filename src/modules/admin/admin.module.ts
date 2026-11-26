import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AdminController } from './admin.controller.js';
import { ReportsController } from './reports.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [UsersModule],
  controllers: [AdminController, ReportsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
