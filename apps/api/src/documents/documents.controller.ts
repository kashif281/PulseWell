import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '@pulseai/types';

@ApiTags('Documents')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload health document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: DocumentType,
  ) {
    return this.documentsService.uploadDocument(userId, file, type ?? DocumentType.OTHER);
  }

  @Get()
  @ApiOperation({ summary: 'List my documents' })
  list(@CurrentUser('sub') userId: string) {
    return this.documentsService.getDocuments(userId);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Download a document (owner or company admin)' })
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.documentsService.getDocumentFile(user, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    );
    res.send(file.buffer);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document' })
  delete(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.documentsService.deleteDocument(userId, id);
  }
}
