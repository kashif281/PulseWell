import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty()
  @IsString()
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Document ID to analyze (use with analyzeDocument)' })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({ description: 'Run full report analysis on documentId' })
  @IsOptional()
  @IsBoolean()
  analyzeDocument?: boolean;

  @ApiPropertyOptional({ description: 'Document ID for follow-up Q&A context (no re-analysis)' })
  @IsOptional()
  @IsString()
  contextDocumentId?: string;

  @ApiPropertyOptional({ description: 'Re-run analysis even if cached' })
  @IsOptional()
  @IsBoolean()
  forceReanalyze?: boolean;
}
