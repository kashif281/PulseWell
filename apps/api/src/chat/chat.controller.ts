import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatMessageDto } from './dto/chat.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Chat')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private aiService: AiService) {}

  @Post()
  @ApiOperation({ summary: 'Send message to AI wellness assistant' })
  sendMessage(@CurrentUser('sub') userId: string, @Body() dto: ChatMessageDto) {
    return this.aiService.chat(userId, dto.message, {
      sessionId: dto.sessionId,
      documentId: dto.documentId,
      contextDocumentId: dto.contextDocumentId,
      analyzeDocument: dto.analyzeDocument,
      forceReanalyze: dto.forceReanalyze,
    });
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List chat sessions' })
  getSessions(@CurrentUser('sub') userId: string) {
    return this.aiService.getSessions(userId);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session messages' })
  getSession(@CurrentUser('sub') userId: string, @Param('id') sessionId: string) {
    return this.aiService.getSessionMessages(userId, sessionId);
  }
}
