import { Module } from '@nestjs/common';
import { MentorsController } from './mentors.controller.js';
import { MentorsService } from './mentors.service.js';

@Module({
  controllers: [MentorsController],
  providers: [MentorsService],
  exports: [MentorsService],
})
export class MentorsModule {}
