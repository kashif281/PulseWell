import { Module, forwardRef } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { LearningCertPdfService } from './learning-cert-pdf.service';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [forwardRef(() => AiModule), StorageModule],
  controllers: [LearningController],
  providers: [LearningService, LearningCertPdfService],
  exports: [LearningService],
})
export class LearningModule {}
