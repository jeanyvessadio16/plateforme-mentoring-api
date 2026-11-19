import { Module } from '@nestjs/common';
import { MasterclassesController } from './masterclasses.controller.js';
import { MasterclassesService } from './masterclasses.service.js';

@Module({
  controllers: [MasterclassesController],
  providers: [MasterclassesService],
  exports: [MasterclassesService],
})
export class MasterclassesModule {}
