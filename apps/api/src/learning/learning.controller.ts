import { Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveCompanyId } from '../common/utils/company-scope';
import type { JwtPayload } from '@pulseai/types';
import { LearningService } from './learning.service';
import { StorageService } from '../storage/storage.service';

@ApiTags('Learning')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('learning')
export class LearningController {
  constructor(
    private learning: LearningService,
    private storage: StorageService,
  ) {}

  @Get('context')
  @ApiOperation({ summary: 'Get learning context for current employee' })
  getContext(@CurrentUser('sub') userId: string) {
    return this.learning.buildLearningContext(userId);
  }

  @Get('materials')
  getMaterials(@CurrentUser('sub') userId: string) {
    return this.learning.getMaterials(userId);
  }

  @Get('skills/me')
  getMySkills(@CurrentUser('sub') userId: string) {
    return this.learning.getMySkills(userId);
  }

  @Get('skills/recommendations')
  getSkillRecommendations(@CurrentUser('sub') userId: string) {
    return this.learning.getSkillRecommendations(userId);
  }

  @Put('skills/:skillId')
  updateSkill(
    @CurrentUser('sub') userId: string,
    @Param('skillId') skillId: string,
    @Body() body: { rating: number },
  ) {
    return this.learning.updateSkillRating(userId, skillId, body.rating);
  }

  @Get('paths')
  getPaths(@CurrentUser('sub') userId: string) {
    return this.learning.getPaths(userId);
  }

  @Post('modules/:moduleId/complete')
  completeModule(
    @CurrentUser('sub') userId: string,
    @Param('moduleId') moduleId: string,
    @Body() body: { minutes?: number },
  ) {
    return this.learning.markModuleProgress(userId, moduleId, body.minutes ?? 15);
  }

  @Get('streak')
  getStreak(@CurrentUser('sub') userId: string) {
    return this.learning.getStreak(userId);
  }

  @Post('quiz/:quizId/submit')
  submitQuiz(
    @CurrentUser('sub') userId: string,
    @Param('quizId') quizId: string,
    @Body() body: { answers: Record<string, string> },
  ) {
    return this.learning.gradeQuiz(userId, quizId, body.answers);
  }

  @Get('challenges')
  listChallenges(@CurrentUser('sub') userId: string) {
    return this.learning.listChallenges(userId);
  }

  @Get('challenges/:id')
  getChallenge(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.learning.getChallenge(userId, id);
  }

  @Post('challenges/:id/run-tests')
  runTests(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: { code: string },
  ) {
    return this.learning.runChallengeTests(userId, id, body.code, false);
  }

  @Get('code/history')
  codeHistory(@CurrentUser('sub') userId: string, @Query('challengeId') challengeId?: string) {
    return this.learning.getCodeHistory(userId, challengeId);
  }

  @Post('code/submit')
  submitCode(
    @CurrentUser('sub') userId: string,
    @Body()
    body: {
      challengeId?: string;
      code: string;
      language?: string;
      chatSessionId?: string;
    },
  ) {
    return this.learning.submitCode(userId, body);
  }

  @Get('certifications/me')
  getMyCerts(@CurrentUser('sub') userId: string) {
    return this.learning.getMyCertifications(userId);
  }

  @Get('certifications/available')
  getAvailableCerts(@CurrentUser('sub') userId: string) {
    return this.learning.getAvailableCertifications(userId);
  }

  @Post('certifications/:id/issue')
  issueCert(@CurrentUser('sub') userId: string, @Param('id') certificationId: string) {
    return this.learning.issueCertification(userId, certificationId);
  }

  @Get('certificates/:employeeCertId/download')
  async downloadCert(
    @CurrentUser('sub') userId: string,
    @Param('employeeCertId') employeeCertId: string,
    @Res() res: Response,
  ) {
    const { pdfUrl } = await this.learning.downloadCertificatePdf(userId, employeeCertId);
    if (pdfUrl.startsWith('http')) {
      return res.redirect(pdfUrl);
    }
    const { buffer, mimeType } = await this.storage.readFile(pdfUrl, 'application/pdf');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'attachment; filename="certificate.pdf"');
    return res.send(buffer);
  }

  @Get('admin/analytics')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  adminAnalytics(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = resolveCompanyId(user, companyId);
    return this.learning.getAdminAnalytics(cid);
  }

  @Get('admin/compliance')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  compliance(@CurrentUser() user: JwtPayload, @Query('companyId') companyId?: string) {
    const cid = resolveCompanyId(user, companyId);
    return this.learning.getComplianceReport(cid);
  }
}
