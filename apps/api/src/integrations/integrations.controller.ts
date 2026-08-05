import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth('JWT')
@Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
@Controller('integrations')
export class IntegrationsController {
  constructor(private integrations: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'List company integrations (Make.com, webhooks)' })
  list(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = resolveCompanyId(user, companyId);
    return this.integrations.list(cid);
  }

  @Post('make')
  @ApiOperation({ summary: 'Connect or update a Make.com custom webhook' })
  upsertMake(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      companyId?: string;
      id?: string;
      webhookUrl: string;
      name?: string;
      events?: string[];
      isActive?: boolean;
      regenerateSecret?: boolean;
    },
  ) {
    const cid = resolveCompanyId(user, body.companyId);
    return this.integrations.upsertMakeWebhook(cid, body);
  }

  @Put('make/:id')
  updateMake(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      companyId?: string;
      webhookUrl: string;
      name?: string;
      events?: string[];
      isActive?: boolean;
      regenerateSecret?: boolean;
    },
  ) {
    const cid = resolveCompanyId(user, body.companyId);
    return this.integrations.upsertMakeWebhook(cid, { ...body, id });
  }

  @Post('make/:id/test')
  @ApiOperation({ summary: 'Send a test event to the Make.com webhook' })
  test(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { companyId?: string },
  ) {
    const cid = resolveCompanyId(user, body?.companyId);
    return this.integrations.testWebhook(cid, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
  ) {
    const cid = resolveCompanyId(user, companyId);
    return this.integrations.delete(cid, id);
  }
}
