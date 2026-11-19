import { Module } from '@nestjs/common';
import { DiagnosticService } from './diagnostic.service.js';
import { DiagnosticController } from './diagnostic.controller.js';
import { MatchingModule } from '../matching/matching.module.js';

@Module({
  imports: [MatchingModule],
  controllers: [DiagnosticController],
  providers: [DiagnosticService],
  exports: [DiagnosticService],
})
export class DiagnosticModule {}
