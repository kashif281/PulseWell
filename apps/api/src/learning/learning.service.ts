import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  LearningDifficulty,
  LearningProgressStatus,
  LearningTrack,
  MockInterviewType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { LlmGateway } from '../ai/llm.gateway';
import { AgentType } from '@prisma/client';
import { resolveLearningTrack, getRecommendedTopics, ROLE_TRACK_TOPICS } from './learning-tracks';
import type { QuizDraft, CodeChallengeDraft } from './learning-draft.util';
import { LEARNING_SYSTEM_PROMPT } from '../ai/prompts/learning.prompt';
import {
  runJavaScriptTests,
  detectFunctionName,
  type CodeTestCase,
} from './learning-code-runner';
import { LearningCertPdfService } from './learning-cert-pdf.service';

@Injectable()
export class LearningService {
  constructor(
    private prisma: PrismaService,
    private llm: LlmGateway,
    private certPdf: LearningCertPdfService,
  ) {}

  async getEmployeeByUserId(userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      include: {
        department: true,
        user: { select: { firstName: true, lastName: true } },
        employeeSkills: { include: { skill: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return employee;
  }

  async buildLearningContext(userId: string): Promise<string> {
    const employee = await this.getEmployeeByUserId(userId);
    const track = resolveLearningTrack(employee.department?.name, employee.position);
    const topics = getRecommendedTopics(track);
    const streak = await this.prisma.learningStreak.findUnique({
      where: { employeeId: employee.id },
    });

    const parts = [
      `Employee: ${employee.user.firstName ?? ''} ${employee.user.lastName ?? ''}`.trim(),
      `Department: ${employee.department?.name ?? 'General'}`,
      `Position: ${employee.position ?? 'Employee'}`,
      `Learning track: ${track}`,
      `Recommended topics: ${topics.join(', ')}`,
    ];

    if (employee.employeeSkills.length) {
      parts.push(
        'Current skills:\n' +
          employee.employeeSkills
            .map((es) => `- ${es.skill.name}: ${'★'.repeat(es.rating)}${'☆'.repeat(5 - es.rating)}`)
            .join('\n'),
      );
    } else {
      parts.push('Current skills: not rated yet — suggest initializing skills for this track.');
    }

    if (streak) {
      parts.push(
        `Learning streak: ${streak.currentStreak} days (longest ${streak.longestStreak}), total ${streak.totalMinutes} min`,
      );
    }

    const paths = await this.prisma.learningPath.findMany({
      where: {
        isActive: true,
        OR: [{ companyId: employee.companyId }, { companyId: null }],
        track,
      },
      include: { modules: { orderBy: { sortOrder: 'asc' }, take: 5 } },
      take: 3,
    });

    if (paths.length) {
      parts.push(
        'Available learning paths:\n' +
          paths.map((p) => `- ${p.title}: ${p.modules.map((m) => m.title).join(', ')}`).join('\n'),
      );
    }

    const materials = await this.prisma.learningMaterial.findMany({
      where: {
        companyId: employee.companyId,
        isActive: true,
        OR: [{ track: null }, { track }],
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    if (materials.length) {
      parts.push(
        'Company learning resources:\n' +
          materials
            .map((m) => `- ${m.title}${m.content ? `: ${m.content.slice(0, 200)}...` : ''}`)
            .join('\n'),
      );
    }

    const lowSkills = employee.employeeSkills.filter((es) => es.rating <= 2);
    if (lowSkills.length) {
      parts.push(
        'Skills to strengthen:\n' +
          lowSkills.map((es) => `- ${es.skill.name} (${es.rating}/5)`).join('\n'),
      );
    }

    return parts.join('\n');
  }

  async getSkillRecommendations(userId: string) {
    const skills = await this.getMySkills(userId);
    return skills
      .filter((s) => s.rating <= 3)
      .sort((a, b) => a.rating - b.rating)
      .slice(0, 8)
      .map((s) => ({
        skillId: s.skill.id,
        name: s.skill.name,
        rating: s.rating,
        suggestion: `Focus on ${s.skill.name} — try a module, quiz, or ask the tutor to explain it.`,
      }));
  }

  async getMaterials(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const track = resolveLearningTrack(employee.department?.name, employee.position);
    return this.prisma.learningMaterial.findMany({
      where: {
        companyId: employee.companyId,
        isActive: true,
        OR: [{ track: null }, { track }],
      },
      orderBy: { title: 'asc' },
    });
  }

  async ensureTrackSkills(employeeId: string, companyId: string, track: LearningTrack) {
    const topicNames = ROLE_TRACK_TOPICS[track];
    for (const name of topicNames) {
      let skill = await this.prisma.skill.findFirst({
        where: { companyId, name },
      });
      if (!skill) {
        skill = await this.prisma.skill.create({
          data: {
            companyId,
            name,
            category: track,
            track,
            description: `Core ${track.toLowerCase()} skill`,
          },
        });
      }
      await this.prisma.employeeSkill.upsert({
        where: { employeeId_skillId: { employeeId, skillId: skill.id } },
        create: { employeeId, skillId: skill.id, rating: 2 },
        update: {},
      });
    }
  }

  async getMySkills(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const track = resolveLearningTrack(employee.department?.name, employee.position);
    await this.ensureTrackSkills(employee.id, employee.companyId, track);
    return this.prisma.employeeSkill.findMany({
      where: { employeeId: employee.id },
      include: { skill: true },
      orderBy: { skill: { name: 'asc' } },
    });
  }

  async updateSkillRating(userId: string, skillId: string, rating: number) {
    const employee = await this.getEmployeeByUserId(userId);
    const clamped = Math.min(5, Math.max(1, Math.round(rating)));
    return this.prisma.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId: employee.id, skillId } },
      create: { employeeId: employee.id, skillId, rating: clamped },
      update: { rating: clamped },
      include: { skill: true },
    });
  }

  async getPaths(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const track = resolveLearningTrack(employee.department?.name, employee.position);
    return this.prisma.learningPath.findMany({
      where: {
        isActive: true,
        OR: [{ companyId: employee.companyId }, { companyId: null }],
        track: { in: [track, LearningTrack.GENERAL] },
      },
      include: {
        modules: { orderBy: { sortOrder: 'asc' } },
        progress: { where: { employeeId: employee.id } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async markModuleProgress(userId: string, moduleId: string, minutes = 15) {
    const employee = await this.getEmployeeByUserId(userId);
    const mod = await this.prisma.learningModule.findUnique({
      where: { id: moduleId },
      include: { path: true },
    });
    if (!mod) throw new NotFoundException('Module not found');

    await this.touchStreak(employee.id, minutes);

    const progress = await this.prisma.learningProgress.upsert({
      where: { employeeId_moduleId: { employeeId: employee.id, moduleId } },
      create: {
        employeeId: employee.id,
        moduleId,
        pathId: mod.pathId,
        status: LearningProgressStatus.COMPLETED,
        timeSpentMin: minutes,
        completedAt: new Date(),
      },
      update: {
        status: LearningProgressStatus.COMPLETED,
        timeSpentMin: { increment: minutes },
        completedAt: new Date(),
      },
    });

    await this.checkPathCompletionAndCertify(employee.id, employee.companyId, mod.pathId);
    return progress;
  }

  private async checkPathCompletionAndCertify(
    employeeId: string,
    companyId: string,
    pathId: string,
  ) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      include: { modules: true },
    });
    if (!path || !path.modules.length) return;

    const completed = await this.prisma.learningProgress.count({
      where: {
        employeeId,
        moduleId: { in: path.modules.map((m) => m.id) },
        status: LearningProgressStatus.COMPLETED,
      },
    });

    if (completed < path.modules.length) return;

    const cert = await this.prisma.certification.findFirst({
      where: { companyId, pathId: path.id },
    });
    if (!cert) return;

    const existing = await this.prisma.employeeCertification.findFirst({
      where: { employeeId, certificationId: cert.id },
    });
    if (existing) return;

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });
    if (!employee) return;

    await this.issueCertification(employee.userId, cert.id);
  }

  async saveQuizDraft(userId: string, chatSessionId: string, draft: QuizDraft) {
    const employee = await this.getEmployeeByUserId(userId);
    await this.touchStreak(employee.id, 5);
    return this.prisma.quizSession.create({
      data: {
        employeeId: employee.id,
        topic: draft.topic,
        difficulty: draft.difficulty,
        questions: draft.questions as object,
        maxScore: draft.questions.length * 10,
        chatSessionId,
      },
    });
  }

  async gradeQuiz(userId: string, quizId: string, answers: Record<string, string>) {
    const employee = await this.getEmployeeByUserId(userId);
    const quiz = await this.prisma.quizSession.findFirst({
      where: { id: quizId, employeeId: employee.id },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.completedAt) throw new BadRequestException('Quiz already completed');

    const questions = quiz.questions as Array<{ number: number; answer: string }>;
    let correct = 0;
    for (const q of questions) {
      const given = answers[String(q.number)]?.toUpperCase();
      if (given && given === q.answer.toUpperCase()) correct += 1;
    }
    const score = Math.round((correct / questions.length) * 100);
    await this.touchStreak(employee.id, 10);

    return this.prisma.quizSession.update({
      where: { id: quiz.id },
      data: {
        answers: answers as object,
        score,
        completedAt: new Date(),
      },
    });
  }

  async saveChallengeDraft(companyId: string, draft: CodeChallengeDraft) {
    return this.prisma.codingChallenge.create({
      data: {
        companyId,
        title: draft.title,
        topic: draft.topic,
        difficulty: draft.difficulty,
        prompt: draft.prompt,
        starterCode: draft.starterCode,
        language: draft.language,
      },
    });
  }

  async getChallenge(userId: string, challengeId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const challenge = await this.prisma.codingChallenge.findFirst({
      where: {
        id: challengeId,
        isActive: true,
        OR: [{ companyId: employee.companyId }, { companyId: null }],
      },
    });
    if (!challenge) throw new NotFoundException('Challenge not found');

    const tests = (challenge.testCases as CodeTestCase[] | null) ?? [];
    return {
      ...challenge,
      sampleTests: tests.filter((t) => !t.hidden),
      hasHiddenTests: tests.some((t) => t.hidden),
    };
  }

  async runChallengeTests(userId: string, challengeId: string, code: string, hidden = false) {
    const challenge = await this.getChallenge(userId, challengeId);
    const allTests = (await this.prisma.codingChallenge.findUnique({ where: { id: challengeId } }))
      ?.testCases as CodeTestCase[] | null;
    const tests = (allTests ?? []).filter((t) => (hidden ? true : !t.hidden));
    const fnName = detectFunctionName(
      code,
      detectFunctionName(challenge.starterCode ?? code, 'solve'),
    );
    const result = runJavaScriptTests(code, fnName, tests);
    return result;
  }

  async getCodeHistory(userId: string, challengeId?: string) {
    const employee = await this.getEmployeeByUserId(userId);
    return this.prisma.codingSubmission.findMany({
      where: {
        employeeId: employee.id,
        ...(challengeId ? { challengeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { challenge: { select: { title: true, topic: true } } },
    });
  }

  async listChallenges(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    return this.prisma.codingChallenge.findMany({
      where: {
        isActive: true,
        OR: [{ companyId: employee.companyId }, { companyId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async submitCode(
    userId: string,
    data: {
      challengeId?: string;
      code: string;
      language?: string;
      interviewType?: MockInterviewType;
      chatSessionId?: string;
    },
  ) {
    const employee = await this.getEmployeeByUserId(userId);
    let testSummary: { passed: number; total: number } | null = null;

    if (data.challengeId && (data.language ?? 'javascript') === 'javascript') {
      const hiddenRun = await this.runChallengeTests(userId, data.challengeId, data.code, true);
      testSummary = { passed: hiddenRun.passed, total: hiddenRun.total };
    }

    const feedbackText = await this.llm.chat(
      LEARNING_SYSTEM_PROMPT,
      [],
      `Review this ${data.language ?? 'javascript'} code submission.${
        testSummary
          ? ` Hidden tests passed: ${testSummary.passed}/${testSummary.total}.`
          : ''
      } Provide score 0-100 and detailed feedback on correctness, readability, performance, security, edge cases, and improvements.\n\nCode:\n${data.code}`,
      await this.buildLearningContext(userId),
      {
        agentType: AgentType.LEARNING,
        userId,
        maxTokens: 1500,
        temperature: 0.3,
        fallback: 'Code received. Consider edge cases and add tests.',
      },
    );

    let score = 70;
    if (testSummary && testSummary.total > 0) {
      score = Math.round((testSummary.passed / testSummary.total) * 100);
    } else {
      const scoreMatch = feedbackText.match(/(\d{1,3})\s*\/\s*100|score[:\s]+(\d{1,3})/i);
      score = scoreMatch
        ? Math.min(100, parseInt(scoreMatch[1] ?? scoreMatch[2] ?? '70', 10))
        : 70;
    }

    await this.touchStreak(employee.id, 15);

    return this.prisma.codingSubmission.create({
      data: {
        employeeId: employee.id,
        challengeId: data.challengeId,
        code: data.code,
        language: data.language ?? 'javascript',
        interviewType: data.interviewType,
        chatSessionId: data.chatSessionId,
        feedback: { review: feedbackText, score, tests: testSummary } as object,
        score,
      },
    });
  }

  async getMyCertifications(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    return this.prisma.employeeCertification.findMany({
      where: { employeeId: employee.id },
      include: { certification: true },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async getAvailableCertifications(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const earned = await this.prisma.employeeCertification.findMany({
      where: { employeeId: employee.id },
      select: { certificationId: true },
    });
    const earnedIds = new Set(earned.map((e) => e.certificationId));

    return this.prisma.certification.findMany({
      where: { companyId: employee.companyId },
      orderBy: [{ isMandatory: 'desc' }, { title: 'asc' }],
    }).then((certs) =>
      certs.map((c) => ({
        ...c,
        earned: earnedIds.has(c.id),
      })),
    );
  }

  async issueCertification(userId: string, certificationId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const cert = await this.prisma.certification.findFirst({
      where: { id: certificationId, companyId: employee.companyId },
    });
    if (!cert) throw new NotFoundException('Certification not found');

    const existing = await this.prisma.employeeCertification.findFirst({
      where: { employeeId: employee.id, certificationId: cert.id },
    });
    if (existing) {
      if (!existing.certificateUrl) {
        await this.certPdf.generateForEmployeeCert(existing.id);
      }
      return this.prisma.employeeCertification.findUnique({
        where: { id: existing.id },
        include: { certification: true },
      });
    }

    const expiresAt = cert.validMonths
      ? new Date(Date.now() + cert.validMonths * 30 * 24 * 60 * 60 * 1000)
      : null;

    const record = await this.prisma.employeeCertification.create({
      data: {
        employeeId: employee.id,
        certificationId: cert.id,
        expiresAt,
      },
      include: { certification: true },
    });

    await this.certPdf.generateForEmployeeCert(record.id);
    return this.prisma.employeeCertification.findUnique({
      where: { id: record.id },
      include: { certification: true },
    });
  }

  async downloadCertificatePdf(userId: string, employeeCertId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    const record = await this.prisma.employeeCertification.findFirst({
      where: { id: employeeCertId, employeeId: employee.id },
    });
    if (!record) throw new NotFoundException('Certificate not found');
    if (!record.certificateUrl) {
      return this.certPdf.generateForEmployeeCert(record.id);
    }
    return { pdfUrl: record.certificateUrl };
  }

  async getAdminAnalytics(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);

    const [quizCount, avgQuizScore, submissions, completedModules, certs, streaks] =
      await Promise.all([
        this.prisma.quizSession.count({ where: { employeeId: { in: employeeIds }, completedAt: { not: null } } }),
        this.prisma.quizSession.aggregate({
          where: { employeeId: { in: employeeIds }, score: { not: null } },
          _avg: { score: true },
        }),
        this.prisma.codingSubmission.count({ where: { employeeId: { in: employeeIds } } }),
        this.prisma.learningProgress.count({
          where: { employeeId: { in: employeeIds }, status: LearningProgressStatus.COMPLETED },
        }),
        this.prisma.employeeCertification.count({
          where: { employeeId: { in: employeeIds } },
        }),
        this.prisma.learningStreak.aggregate({
          where: { employeeId: { in: employeeIds } },
          _avg: { currentStreak: true, totalMinutes: true },
        }),
      ]);

    const mandatoryCerts = await this.prisma.certification.findMany({
      where: { companyId, isMandatory: true },
    });

    const departments = await this.prisma.department.findMany({
      where: { companyId },
      include: {
        employees: {
          select: {
            id: true,
            learningProgress: { where: { status: LearningProgressStatus.COMPLETED } },
            quizSessions: { where: { completedAt: { not: null } } },
          },
        },
      },
    });

    const departmentProgress = departments.map((d) => {
      const empCount = d.employees.length;
      const modules = d.employees.reduce((s, e) => s + e.learningProgress.length, 0);
      const quizzes = d.employees.reduce((s, e) => s + e.quizSessions.length, 0);
      return {
        department: d.name,
        employees: empCount,
        modulesCompleted: modules,
        quizzesCompleted: quizzes,
      };
    });

    const compliance = await this.getComplianceReport(companyId);

    return {
      employeeCount: employeeIds.length,
      quizzesCompleted: quizCount,
      averageQuizScore: Math.round(avgQuizScore._avg.score ?? 0),
      codingSubmissions: submissions,
      modulesCompleted: completedModules,
      certificationsEarned: certs,
      mandatoryCertifications: mandatoryCerts.length,
      averageStreak: Math.round(streaks._avg.currentStreak ?? 0),
      averageLearningMinutes: Math.round(streaks._avg.totalMinutes ?? 0),
      departmentProgress,
      compliance,
    };
  }

  async getComplianceReport(companyId: string) {
    const mandatory = await this.prisma.certification.findMany({
      where: { companyId, isMandatory: true },
    });
    if (!mandatory.length) return { compliant: 0, nonCompliant: 0, employees: [] as unknown[] };

    const employees = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: 'ACTIVE' },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        certifications: {
          where: { certificationId: { in: mandatory.map((m) => m.id) } },
          include: { certification: true },
        },
      },
    });

    const rows = employees.map((e) => {
      const missing = mandatory.filter(
        (m) => !e.certifications.some((c) => c.certificationId === m.id),
      );
      const expired = e.certifications.filter(
        (c) => c.expiresAt && c.expiresAt < new Date(),
      );
      return {
        employeeId: e.id,
        name: `${e.user.firstName ?? ''} ${e.user.lastName ?? ''}`.trim(),
        email: e.user.email,
        compliant: missing.length === 0 && expired.length === 0,
        missingMandatory: missing.map((m) => m.title),
        expired: expired.map((c) => c.certification.title),
      };
    });

    return {
      compliant: rows.filter((r) => r.compliant).length,
      nonCompliant: rows.filter((r) => !r.compliant).length,
      employees: rows,
    };
  }

  async touchStreak(employeeId: string, minutes: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await this.prisma.learningStreak.findUnique({ where: { employeeId } });

    if (!existing) {
      return this.prisma.learningStreak.create({
        data: {
          employeeId,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveAt: new Date(),
          totalMinutes: minutes,
        },
      });
    }

    const last = existing.lastActiveAt ? new Date(existing.lastActiveAt) : null;
    let currentStreak = existing.currentStreak;
    if (last) {
      last.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays === 1) currentStreak += 1;
      else if (diffDays > 1) currentStreak = 1;
    } else {
      currentStreak = 1;
    }

    return this.prisma.learningStreak.update({
      where: { employeeId },
      data: {
        currentStreak,
        longestStreak: Math.max(existing.longestStreak, currentStreak),
        lastActiveAt: new Date(),
        totalMinutes: { increment: minutes },
      },
    });
  }

  async getStreak(userId: string) {
    const employee = await this.getEmployeeByUserId(userId);
    return (
      (await this.prisma.learningStreak.findUnique({ where: { employeeId: employee.id } })) ?? {
        currentStreak: 0,
        longestStreak: 0,
        totalMinutes: 0,
      }
    );
  }
}
