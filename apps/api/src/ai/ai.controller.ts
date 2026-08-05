import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgentType, UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';
import { AiGatewayService } from './ai-gateway.service';
import { ConversationService } from './conversation.service';
import { HrPolicyPdfService } from './hr-policy-pdf.service';
import { HrPolicyActionsService } from './hr-policy-actions.service';
import { CompanyPolicyService } from '../company/company-policy.service';
import { AgentChatDto, HrExportPdfDto, HrPublishDraftDto } from './dto/agent-chat.dto';

@ApiTags('AI')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private gateway: AiGatewayService,
    private conversation: ConversationService,
    private hrPdf: HrPolicyPdfService,
    private policyActions: HrPolicyActionsService,
    private policyService: CompanyPolicyService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Send message to an AI agent' })
  sendMessage(@CurrentUser() user: JwtPayload, @Body() dto: AgentChatDto) {
    const agentType = dto.agentType ?? AgentType.LEARNING;
    if (agentType === AgentType.WELLNESS) {
      throw new BadRequestException('Wellness coaching is disabled for this product configuration');
    }
    if (agentType === AgentType.HR) {
      const companyId = dto.companyId
        ? resolveCompanyId(user, dto.companyId)
        : user.companyId;
      if (!companyId && user.role === UserRole.SUPER_ADMIN) {
        throw new BadRequestException('companyId is required for HR Agent');
      }
      return this.gateway.chat(user.sub, agentType, dto.message, {
        sessionId: dto.sessionId,
        companyId: companyId ?? dto.companyId,
      });
    }

    return this.gateway.chat(user.sub, agentType, dto.message, {
      sessionId: dto.sessionId,
    });
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List agent chat sessions' })
  getSessions(
    @CurrentUser('sub') userId: string,
    @Query('agentType') agentType?: AgentType,
  ) {
    if (agentType === AgentType.WELLNESS) {
      throw new BadRequestException('Wellness coaching is disabled for this product configuration');
    }
    return this.gateway.getSessions(userId, agentType ?? AgentType.LEARNING);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get agent session messages' })
  getSession(
    @CurrentUser('sub') userId: string,
    @Param('id') sessionId: string,
    @Query('agentType') agentType?: AgentType,
  ) {
    if (agentType === AgentType.WELLNESS) {
      throw new BadRequestException('Wellness coaching is disabled for this product configuration');
    }
    return this.gateway.getSessionMessages(userId, sessionId, agentType ?? AgentType.LEARNING);
  }

  @Post('hr/publish-draft')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Publish HR policy draft from chat session to company policies' })
  async publishDraft(@CurrentUser() user: JwtPayload, @Body() dto: HrPublishDraftDto) {
    const companyId = resolveCompanyId(user, dto.companyId);
    return this.policyActions.publishDraft(companyId, user.sub, dto.sessionId);
  }

  @Post('hr/export-pdf')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export HR policy as PDF' })
  async exportPdf(
    @CurrentUser() user: JwtPayload,
    @Body() dto: HrExportPdfDto,
    @Res() res: Response,
  ) {
    const companyId = resolveCompanyId(user, dto.companyId);

    if (dto.policyId) {
      const policy = await this.policyService.getPolicy(companyId, dto.policyId);
      let pdfUrl = policy.pdfUrl;
      if (!pdfUrl) {
        const result = await this.hrPdf.generateForPolicy(companyId, policy.id);
        pdfUrl = result.pdfUrl;
      }
      return res.json({ pdfUrl, title: policy.title });
    }

    if (dto.sessionId) {
      const draft = await this.policyActions.resolveDraft(user.sub, dto.sessionId);
      const buffer = await this.hrPdf.generateFromDraft(companyId, draft);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${draft.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf"`,
      );
      return res.send(buffer);
    }

    throw new BadRequestException('Provide sessionId or policyId');
  }
}
