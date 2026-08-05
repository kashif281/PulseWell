import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { AiService } from './ai.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [ChatController],
  providers: [AiService],
  exports: [AiService],
})
export class ChatModule {}
