/**
 * Nura demo seed — idempotent. Safe to run multiple times.
 * Run: npm run db:seed
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function requiredSecret(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to seed demo accounts; set it in .env`);
  }
  return value;
}

const EMPLOYEE_PASSWORD = requiredSecret('DEMO_EMPLOYEE_PASSWORD');
const TOTAL_EMPLOYEES = 30;

const ACCOUNTS = {
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@nura.app',
    password: requiredSecret('SUPER_ADMIN_PASSWORD'),
    firstName: 'Super',
    lastName: 'Admin',
    role: 'SUPER_ADMIN',
  },
  companyAdmin: {
    email: process.env.DEMO_ADMIN_EMAIL || 'admin@acme.com',
    password: requiredSecret('DEMO_ADMIN_PASSWORD'),
    firstName: 'Sarah',
    lastName: 'Mitchell',
    role: 'COMPANY_ADMIN',
  },
  employee: {
    email: process.env.DEMO_EMPLOYEE_EMAIL || 'employee@acme.com',
    password: EMPLOYEE_PASSWORD,
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'EMPLOYEE',
  },
  employee2: {
    email: process.env.DEMO_EMPLOYEE2_EMAIL || 'john@acme.com',
    password: EMPLOYEE_PASSWORD,
    firstName: 'John',
    lastName: 'Anderson',
    role: 'EMPLOYEE',
  },
};

const COMPANY = {
  name: 'Acme Corporation',
  industry: 'Technology',
  country: 'Pakistan',
  timezone: 'Asia/Karachi',
  employeeCount: TOTAL_EMPLOYEES,
  insuranceProvider: 'BlueCross Premier',
  healthcareBudget: 250000,
  officeAddress: 'Matti Spaces, Nawab Town, Lahore',
  officeCity: 'Lahore',
  officeLatitude: 31.4541,
  officeLongitude: 74.2481,
};

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function scoreCheckin({ sleepHours = 7, exerciseMinutes = 30, stress = 'LOW', mealsCount = 3, waterIntake = 2.5 }) {
  const stressMap = { VERY_LOW: 10, LOW: 25, MODERATE: 50, HIGH: 75, VERY_HIGH: 90 };
  const sleepScore = sleepHours >= 7 && sleepHours <= 9 ? 100 : Math.max(20, Math.round((sleepHours / 7) * 100));
  const exerciseScore = exerciseMinutes >= 30 ? 100 : Math.round((exerciseMinutes / 30) * 100);
  const stressScore = 100 - (stressMap[stress] ?? 50);
  const nutritionScore = mealsCount >= 3 ? 100 : Math.round((mealsCount / 3) * 100);
  const hydrationScore = waterIntake >= 2 ? 100 : Math.round((waterIntake / 2) * 100);
  const overall = Math.round(
    sleepScore * 0.2 + exerciseScore * 0.2 + stressScore * 0.2 + nutritionScore * 0.2 + hydrationScore * 0.2,
  );
  return { overall, sleepScore, exerciseScore, stressScore, nutritionScore, hydrationScore };
}

async function upsertUser({ email, password, passwordHash, firstName, lastName, role, companyId = null }) {
  const hash = passwordHash ?? (await bcrypt.hash(password, 12));
  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hash,
      firstName,
      lastName,
      role,
      companyId,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email,
      passwordHash: hash,
      firstName,
      lastName,
      role,
      companyId,
      emailVerified: true,
      isActive: true,
    },
  });
}

/** 30-employee roster: Jane + John + 28 generated staff */
const EXTRA_EMPLOYEES = [
  ['Emma', 'Wilson', 'Sales', 'Account Executive', 'FEMALE', 31],
  ['Michael', 'Chen', 'Engineering', 'Senior Developer', 'MALE', 35],
  ['Olivia', 'Brown', 'Marketing', 'Content Strategist', 'FEMALE', 28],
  ['James', 'Taylor', 'Operations', 'Operations Analyst', 'MALE', 42],
  ['Sophia', 'Martinez', 'Human Resources', 'HR Specialist', 'FEMALE', 33],
  ['William', 'Garcia', 'Engineering', 'DevOps Engineer', 'MALE', 30],
  ['Ava', 'Rodriguez', 'Finance', 'Financial Analyst', 'FEMALE', 27],
  ['Benjamin', 'Lee', 'Sales', 'Sales Manager', 'MALE', 38],
  ['Isabella', 'Walker', 'Marketing', 'Marketing Coordinator', 'FEMALE', 26],
  ['Lucas', 'Hall', 'Engineering', 'QA Engineer', 'MALE', 29],
  ['Mia', 'Allen', 'Operations', 'Logistics Coordinator', 'FEMALE', 32],
  ['Henry', 'Young', 'Finance', 'Accountant', 'MALE', 40],
  ['Charlotte', 'King', 'Engineering', 'Frontend Developer', 'FEMALE', 28],
  ['Alexander', 'Wright', 'Sales', 'Business Development Rep', 'MALE', 24],
  ['Amelia', 'Scott', 'Human Resources', 'Recruiter', 'FEMALE', 30],
  ['Daniel', 'Green', 'Engineering', 'Backend Developer', 'MALE', 33],
  ['Harper', 'Adams', 'Marketing', 'Social Media Manager', 'FEMALE', 25],
  ['Matthew', 'Baker', 'Operations', 'Facilities Manager', 'MALE', 45],
  ['Evelyn', 'Nelson', 'Finance', 'Payroll Specialist', 'FEMALE', 36],
  ['Joseph', 'Carter', 'Engineering', 'Tech Lead', 'MALE', 37],
  ['Abigail', 'Mitchell', 'Sales', 'Customer Success Manager', 'FEMALE', 34],
  ['David', 'Perez', 'Marketing', 'Brand Manager', 'MALE', 39],
  ['Emily', 'Roberts', 'Human Resources', 'Benefits Coordinator', 'FEMALE', 31],
  ['Christopher', 'Turner', 'Engineering', 'Mobile Developer', 'MALE', 28],
  ['Elizabeth', 'Phillips', 'Finance', 'Controller', 'FEMALE', 44],
  ['Andrew', 'Campbell', 'Operations', 'Supply Chain Analyst', 'MALE', 32],
  ['Sofia', 'Parker', 'Sales', 'Inside Sales Rep', 'FEMALE', 27],
  ['Ryan', 'Evans', 'Marketing', 'SEO Specialist', 'MALE', 29],
];

function emailFor(firstName, lastName) {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@acme.com`;
}

function checkinPatternForTier(tier, index) {
  if (tier === 'healthy') {
    return () => ({
      sleepHours: 7 + Math.random() * 1.5,
      mood: ['GOOD', 'EXCELLENT', 'NEUTRAL'][index % 3],
      energy: ['HIGH', 'MODERATE', 'HIGH'][index % 3],
      stress: ['LOW', 'VERY_LOW', 'LOW'][index % 3],
      exerciseMinutes: 30 + Math.floor(Math.random() * 30),
      waterIntake: 2 + Math.random() * 1,
      mealsCount: 3,
    });
  }
  if (tier === 'at-risk') {
    return (i) => ({
      sleepHours: 4.5 + (i % 4) * 0.5,
      mood: ['LOW', 'VERY_LOW', 'NEUTRAL'][i % 3],
      energy: ['LOW', 'VERY_LOW', 'LOW'][i % 3],
      stress: ['HIGH', 'VERY_HIGH', 'HIGH'][i % 3],
      exerciseMinutes: i % 5 === 0 ? 15 : 0,
      waterIntake: 0.8 + (i % 3) * 0.2,
      mealsCount: i % 2 === 0 ? 1 : 2,
    });
  }
  return (i) => ({
    sleepHours: 6 + (i % 3) * 0.5,
    mood: ['NEUTRAL', 'GOOD', 'LOW'][i % 3],
    energy: ['MODERATE', 'LOW', 'MODERATE'][i % 3],
    stress: ['MODERATE', 'HIGH', 'MODERATE'][i % 3],
    exerciseMinutes: 10 + (i % 4) * 10,
    waterIntake: 1.5 + (i % 2) * 0.5,
    mealsCount: 2 + (i % 2),
  });
}

async function seedHrmData(company, seededEmployees, adminUser) {
  const companyId = company.id;
  const year = new Date().getFullYear();

  const leaveTypes = [
    { name: 'Annual Leave', code: 'ANNUAL', daysPerYear: 20 },
    { name: 'Sick Leave', code: 'SICK', daysPerYear: 10 },
    { name: 'Casual Leave', code: 'CASUAL', daysPerYear: 5 },
    { name: 'Work From Home', code: 'WFH', daysPerYear: 24 },
    { name: 'Unpaid Leave', code: 'UNPAID', daysPerYear: 0, isPaid: false },
  ];

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { companyId_code: { companyId, code: lt.code } },
      update: {},
      create: { companyId, ...lt, isPaid: lt.isPaid ?? true },
    });
  }

  const types = await prisma.leaveType.findMany({ where: { companyId } });
  const annual = types.find((t) => t.code === 'ANNUAL');
  const sick = types.find((t) => t.code === 'SICK');

  const holidays = [
    { name: 'New Year', date: new Date(year, 0, 1) },
    { name: 'Independence Day', date: new Date(year, 6, 4) },
    { name: 'Thanksgiving', date: new Date(year, 10, 27) },
    { name: 'Christmas', date: new Date(year, 11, 25) },
  ];
  for (const h of holidays) {
    const exists = await prisma.holiday.findFirst({ where: { companyId, date: h.date } });
    if (!exists) await prisma.holiday.create({ data: { companyId, ...h } });
  }

  for (const { employee } of seededEmployees) {
    for (const lt of types) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: lt.id, year } },
        update: {},
        create: {
          employeeId: employee.id,
          leaveTypeId: lt.id,
          year,
          allocated: lt.daysPerYear,
          used: 0,
          remaining: lt.daysPerYear,
        },
      });
    }

    await prisma.salaryStructure.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: {
        employeeId: employee.id,
        baseSalary: employee.baseSalary ?? 5000,
        allowances: [
          { type: 'TRANSPORT', amount: 200 },
          { type: 'MEDICAL', amount: 150 },
        ],
        deductions: [{ type: 'INSURANCE', amount: 100 }],
      },
    });

    for (let d = 1; d < 14; d++) {
      const date = daysAgo(d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const checkIn = new Date(date);
      checkIn.setHours(8 + (d % 3), 45 + (d % 4) * 5, 0, 0);
      const checkOut = new Date(date);
      checkOut.setHours(17, 15, 0, 0);
      const lateMinutes = d % 7 === 0 ? 20 : 0;
      const hours = (checkOut - checkIn) / 3600000;
      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: employee.id, date } },
        update: {},
        create: {
          employeeId: employee.id,
          date,
          checkInAt: checkIn,
          checkOutAt: checkOut,
          status: lateMinutes > 0 ? 'LATE' : d % 11 === 0 ? 'REMOTE' : 'PRESENT',
          isRemote: d % 11 === 0,
          workingHours: hours,
          overtimeHours: Math.max(0, hours - 8),
          lateMinutes,
        },
      });
    }
  }

  if (annual && sick) {
    const jane = seededEmployees[0].employee;
    const john = seededEmployees[1].employee;
    const emma = seededEmployees[2]?.employee;
    const today = daysAgo(0);
    today.setHours(0, 0, 0, 0);
    const leaveEndJohn = new Date(today);
    leaveEndJohn.setDate(leaveEndJohn.getDate() + 2);
    const upcomingStart = new Date(today);
    upcomingStart.setDate(upcomingStart.getDate() + 3);
    const upcomingEnd = new Date(upcomingStart);
    upcomingEnd.setDate(upcomingEnd.getDate() + 2);

    await prisma.leaveRequest.deleteMany({
      where: { employeeId: { in: [jane.id, john.id, ...(emma ? [emma.id] : [])] } },
    });

    await prisma.leaveRequest.create({
      data: {
        employeeId: jane.id,
        leaveTypeId: annual.id,
        startDate: upcomingStart,
        endDate: upcomingEnd,
        reason: 'Family vacation',
        status: 'PENDING',
      },
    });
    const janePending = await prisma.leaveRequest.findFirst({
      where: { employeeId: jane.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (janePending) {
      await prisma.approvalRequest.create({
        data: {
          companyId,
          employeeId: jane.id,
          type: 'LEAVE',
          referenceId: janePending.id,
          title: 'Leave request: Annual Leave',
          status: 'PENDING',
        },
      });
    }

    await prisma.leaveRequest.create({
      data: {
        employeeId: john.id,
        leaveTypeId: sick.id,
        startDate: today,
        endDate: leaveEndJohn,
        reason: 'Flu recovery',
        status: 'APPROVED',
        hrApprovedAt: new Date(),
      },
    });
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: john.id, date: today } },
      update: { status: 'ON_LEAVE', checkInAt: null, checkOutAt: null, isRemote: false },
      create: { employeeId: john.id, date: today, status: 'ON_LEAVE' },
    });

    if (emma) {
      await prisma.leaveRequest.create({
        data: {
          employeeId: emma.id,
          leaveTypeId: annual.id,
          startDate: upcomingStart,
          endDate: upcomingEnd,
          reason: 'Personal travel',
          status: 'APPROVED',
          hrApprovedAt: new Date(),
        },
      });
    }
  }

  await seedTodayAttendance(companyId, seededEmployees);

  const payrollCount = await prisma.payroll.count({ where: { companyId } });
  if (payrollCount === 0) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const payroll = await prisma.payroll.create({
      data: {
        companyId,
        periodStart,
        periodEnd,
        status: 'PAID',
        generatedAt: periodStart,
        paidAt: new Date(),
        totalGross: 0,
        totalNet: 0,
      },
    });
    let gross = 0;
    let net = 0;
    for (const { employee } of seededEmployees.slice(0, 10)) {
      const base = Number(employee.baseSalary ?? 5000);
      const allowances = 350;
      const deductions = 600;
      const itemNet = base + allowances - deductions;
      const item = await prisma.payrollItem.create({
        data: {
          payrollId: payroll.id,
          employeeId: employee.id,
          baseSalary: base,
          totalAllowances: allowances,
          totalDeductions: deductions,
          tax: base * 0.1,
          netSalary: itemNet,
          breakdown: {
            allowances: [
              { type: 'TRANSPORT', amount: 200 },
              { type: 'MEDICAL', amount: 150 },
            ],
            deductions: [{ type: 'INSURANCE', amount: 100 }],
          },
        },
      });
      await prisma.salaryPayment.create({
        data: {
          payrollItemId: item.id,
          employeeId: employee.id,
          amount: itemNet,
          status: 'PAID',
          paidAt: payroll.paidAt ?? new Date(),
        },
      });
      gross += base + allowances;
      net += itemNet;
    }
    await prisma.payroll.update({ where: { id: payroll.id }, data: { totalGross: gross, totalNet: net } });
  }

  await backfillPaidSalaryPayments();

  console.log('  HRMS data seeded (attendance, leave, payroll, holidays)');
}

async function backfillPaidSalaryPayments() {
  const unpaidItems = await prisma.payrollItem.findMany({
    where: {
      salaryPayment: null,
      payroll: { status: 'PAID' },
    },
    include: { payroll: true },
  });

  for (const item of unpaidItems) {
    await prisma.salaryPayment.create({
      data: {
        payrollItemId: item.id,
        employeeId: item.employeeId,
        amount: item.netSalary,
        status: 'PAID',
        paidAt: item.payroll.paidAt ?? new Date(),
      },
    });
  }

  if (unpaidItems.length > 0) {
    console.log(`  Backfilled ${unpaidItems.length} paid salary payment record(s)`);
  }
}

async function seedTodayAttendance(companyId, seededEmployees) {
  const today = daysAgo(0);
  today.setHours(0, 0, 0, 0);
  const ids = seededEmployees.map((e) => e.employee.id);
  const onLeaveRows = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: ids },
      status: 'APPROVED',
      startDate: { lte: today },
      endDate: { gte: today },
    },
    select: { employeeId: true },
  });
  const onLeaveIds = new Set(onLeaveRows.map((l) => l.employeeId));

    await prisma.attendanceSession.deleteMany({
      where: { attendance: { employeeId: { in: ids.filter((id) => !onLeaveIds.has(id)) }, date: today } },
    });
    await prisma.attendance.deleteMany({
    where: {
      employeeId: { in: ids.filter((id) => !onLeaveIds.has(id)) },
      date: today,
    },
  });

  let presentCount = 0;
  for (const { employee, user } of seededEmployees) {
    if (onLeaveIds.has(employee.id)) continue;
    // Leave demo employee without today's attendance so they can try check-in
    if (user.email === (process.env.DEMO_EMPLOYEE_EMAIL || 'employee@acme.com')) continue;
    presentCount++;
    if (presentCount > 24) continue;

    const checkIn = new Date(today);
    checkIn.setHours(8 + (presentCount % 2), 20 + (presentCount % 4) * 10, 0, 0);
    const checkedOut = presentCount % 3 !== 1;
    const checkOut = checkedOut ? new Date(today) : null;
    if (checkOut) checkOut.setHours(17, 5, 0, 0);
    const isLate = presentCount % 5 === 0;
    const isRemote = presentCount % 7 === 0;
    const multiSession = presentCount % 4 === 0;
    const onBreak = presentCount % 6 === 0 && !multiSession;

    let liveStatus = 'ABSENT';
    let dayEndedAt = null;
    if (checkedOut && !onBreak) {
      liveStatus = 'CHECKED_OUT';
      dayEndedAt = checkOut;
    } else if (onBreak) {
      liveStatus = 'ON_BREAK';
    } else if (checkOut) {
      liveStatus = 'CHECKING'; // will fix below
    } else {
      liveStatus = isRemote ? 'REMOTE' : 'WORKING';
    }
    if (liveStatus === 'CHECKING') liveStatus = isRemote ? 'REMOTE' : 'WORKING';

    const att = await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date: today,
        checkInAt: checkIn,
        checkOutAt: onBreak ? checkOut : checkedOut ? checkOut : null,
        firstCheckInAt: checkIn,
        lastCheckOutAt: checkOut,
        status: isLate ? 'LATE' : isRemote ? 'REMOTE' : 'PRESENT',
        liveStatus: onBreak ? 'ON_BREAK' : checkedOut ? 'CHECKED_OUT' : isRemote ? 'REMOTE' : 'WORKING',
        isRemote,
        lateMinutes: isLate ? 25 : 0,
        workingHours: checkedOut ? (multiSession ? 7.5 : 8) : onBreak ? 3.5 : null,
        totalBreakMinutes: multiSession ? 60 : onBreak ? 30 : 0,
        sessionCount: multiSession ? 2 : onBreak ? 1 : 1,
        dayEndedAt,
      },
    });

    if (multiSession) {
      const lunchOut = new Date(today);
      lunchOut.setHours(12, 30, 0, 0);
      const lunchIn = new Date(today);
      lunchIn.setHours(13, 30, 0, 0);
      await prisma.attendanceSession.createMany({
        data: [
          { attendanceId: att.id, sessionNumber: 1, checkInAt: checkIn, checkOutAt: lunchOut, workingHours: 3.5, isRemote },
          { attendanceId: att.id, sessionNumber: 2, checkInAt: lunchIn, checkOutAt: checkOut, workingHours: 4, isRemote },
        ],
      });
    } else if (onBreak) {
      await prisma.attendanceSession.create({
        data: {
          attendanceId: att.id,
          sessionNumber: 1,
          checkInAt: checkIn,
          checkOutAt: checkOut,
          workingHours: 3.5,
          isRemote,
        },
      });
    } else {
      await prisma.attendanceSession.create({
        data: {
          attendanceId: att.id,
          sessionNumber: 1,
          checkInAt: checkIn,
          checkOutAt: checkedOut ? checkOut : null,
          workingHours: checkedOut ? 8 : null,
          isRemote,
        },
      });
    }
  }
}

async function upsertEmployee(userId, companyId, departmentId, profile) {
  return prisma.employee.upsert({
    where: { userId },
    update: {
      companyId,
      departmentId,
      onboardingComplete: true,
      ...profile,
    },
    create: {
      userId,
      companyId,
      departmentId,
      onboardingComplete: true,
      ...profile,
    },
  });
}

async function seedHealthMetrics(employeeId, baseWeight, checkinPattern, days = 14) {
  await prisma.healthMetric.deleteMany({ where: { employeeId } });

  const rows = [];
  for (let i = 0; i < days; i++) {
    const recordedAt = daysAgo(i);
    const variant = checkinPattern(i);
    const weight = baseWeight + (Math.random() - 0.5) * 1.2;
    rows.push({
      employeeId,
      type: 'WEIGHT',
      value: Math.round(weight * 10) / 10,
      unit: 'kg',
      recordedAt,
    });
    if (variant.sleepHours) {
      rows.push({
        employeeId,
        type: 'SLEEP',
        value: Math.round(variant.sleepHours * 10) / 10,
        unit: 'hours',
        recordedAt,
      });
    }
    if (variant.exerciseMinutes) {
      rows.push({
        employeeId,
        type: 'EXERCISE_MINUTES',
        value: variant.exerciseMinutes,
        unit: 'min',
        recordedAt,
      });
    }
  }
  await prisma.healthMetric.createMany({ data: rows });
}

async function seedCheckins(employeeId, pattern, days = 14) {
  for (let i = 0; i < days; i++) {
    const date = daysAgo(i);
    const variant = pattern(i);
    const scores = scoreCheckin(variant);
    await prisma.healthCheckin.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: {
        sleepHours: variant.sleepHours,
        mood: variant.mood,
        energy: variant.energy,
        stress: variant.stress,
        exerciseMinutes: variant.exerciseMinutes,
        waterIntake: variant.waterIntake,
        mealsCount: variant.mealsCount,
        healthScore: scores.overall,
      },
      create: {
        employeeId,
        date,
        sleepHours: variant.sleepHours,
        mood: variant.mood,
        energy: variant.energy,
        stress: variant.stress,
        exerciseMinutes: variant.exerciseMinutes,
        waterIntake: variant.waterIntake,
        mealsCount: variant.mealsCount,
        healthScore: scores.overall,
      },
    });
    await prisma.wellnessScore.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: {
        overallScore: scores.overall,
        sleepScore: scores.sleepScore,
        exerciseScore: scores.exerciseScore,
        stressScore: scores.stressScore,
        nutritionScore: scores.nutritionScore,
        hydrationScore: scores.hydrationScore,
      },
      create: {
        employeeId,
        date,
        overallScore: scores.overall,
        sleepScore: scores.sleepScore,
        exerciseScore: scores.exerciseScore,
        stressScore: scores.stressScore,
        nutritionScore: scores.nutritionScore,
        hydrationScore: scores.hydrationScore,
      },
    });
  }
}

async function seedEmailTemplates(company) {
  const templates = [
    {
      name: 'Welcome',
      subject: 'Welcome to the team, {{firstName}}!',
      body: 'Hi {{firstName}},\n\nWelcome aboard! We are glad to have you. Please complete your wellness profile and reach out if you need anything.\n\nBest regards,\nHR Team',
    },
    {
      name: 'Health Reminder',
      subject: 'Friendly wellness check-in',
      body: 'Hi {{firstName}},\n\nJust checking in on how you are feeling. Please complete your daily check-in when you can.\n\nBest regards,\nHR Team',
    },
    {
      name: 'Insurance Update',
      subject: 'Insurance benefits update',
      body: 'Hi {{firstName}},\n\nWe have an update regarding your insurance benefits. Please review the attached details or reply with any questions.\n\nBest regards,\nHR Team',
    },
    {
      name: 'Vaccination Reminder',
      subject: 'Vaccination reminder',
      body: 'Hi {{firstName}},\n\nThis is a reminder about upcoming vaccination opportunities. Reply if you would like more information.\n\nBest regards,\nHR Team',
    },
    {
      name: 'Mental Wellness',
      subject: 'Mental wellness resources',
      body: 'Hi {{firstName}},\n\nWe want to remind you that mental wellness support is available. Please reply if you would like to talk or need resources.\n\nBest regards,\nHR Team',
    },
    {
      name: 'Benefits',
      subject: 'Your employee benefits',
      body: 'Hi {{firstName}},\n\nHere is a summary of your employee benefits. Let us know if anything is unclear.\n\nBest regards,\nHR Team',
    },
    {
      name: 'Return To Work',
      subject: 'Return to work check-in',
      body: 'Hi {{firstName}},\n\nWe hope you are feeling better. Please let us know how we can support your return to work.\n\nBest regards,\nHR Team',
    },
  ];

  for (const t of templates) {
    const exists = await prisma.emailTemplate.findFirst({
      where: { companyId: company.id, name: t.name },
    });
    if (!exists) {
      await prisma.emailTemplate.create({ data: { companyId: company.id, ...t } });
    }
  }
  console.log('  Email templates seeded');
}

async function seedLearningData(company) {
  const paths = [
    {
      title: 'Full-Stack Engineering Foundations',
      track: 'ENGINEERING',
      modules: [
        { title: 'JavaScript Fundamentals', summary: 'Variables, functions, async, closures', durationMin: 45 },
        { title: 'TypeScript Essentials', summary: 'Types, interfaces, generics', durationMin: 40 },
        { title: 'React & Next.js', summary: 'Components, hooks, routing', durationMin: 60 },
        { title: 'Node.js & NestJS', summary: 'APIs, modules, dependency injection', durationMin: 55 },
      ],
    },
    {
      title: 'HR Professional Development',
      track: 'HR',
      modules: [
        { title: 'Recruitment Best Practices', summary: 'Sourcing, interviewing, onboarding', durationMin: 35 },
        { title: 'Labor Law Basics', summary: 'Compliance and workplace policies', durationMin: 40 },
        { title: 'Performance Management', summary: 'Reviews, feedback, goals', durationMin: 30 },
      ],
    },
    {
      title: 'Finance Fundamentals',
      track: 'FINANCE',
      modules: [
        { title: 'Financial Reporting', summary: 'Statements, ratios, analysis', durationMin: 45 },
        { title: 'Budgeting & Forecasting', summary: 'Planning cycles, variance', durationMin: 40 },
      ],
    },
  ];

  for (const [pi, p] of paths.entries()) {
    let path = await prisma.learningPath.findFirst({
      where: { companyId: company.id, title: p.title },
    });
    if (!path) {
      path = await prisma.learningPath.create({
        data: {
          companyId: company.id,
          title: p.title,
          description: `Role-based path for ${p.track}`,
          track: p.track,
          sortOrder: pi,
        },
      });
    }
    for (const [mi, m] of p.modules.entries()) {
      const exists = await prisma.learningModule.findFirst({
        where: { pathId: path.id, title: m.title },
      });
      if (!exists) {
        await prisma.learningModule.create({
          data: {
            pathId: path.id,
            title: m.title,
            summary: m.summary,
            content: `${m.summary}\n\nComplete this module and ask the Learning Agent to quiz you on the topic.`,
            sortOrder: mi,
            durationMin: m.durationMin,
          },
        });
      }
    }
  }

  const challenges = [
    {
      title: 'Two Sum',
      topic: 'Arrays',
      difficulty: 'EASY',
      prompt: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      starterCode: 'function twoSum(nums, target) {\n  // return [i, j]\n}',
      testCases: [
        { name: 'basic', args: [[2, 7, 11, 15], 9], expected: [0, 1], hidden: false },
        { name: 'pair', args: [[3, 2, 4], 6], expected: [1, 2], hidden: false },
        { name: 'duplicate', args: [[3, 3], 6], expected: [0, 1], hidden: true },
      ],
    },
    {
      title: 'Valid Parentheses',
      topic: 'Strings',
      difficulty: 'MEDIUM',
      prompt: 'Given a string s containing just the characters (, ), {, }, [ and ], determine if the input string is valid.',
      starterCode: 'function isValid(s) {\n  \n}',
      testCases: [
        { name: 'simple', args: ['()'], expected: true, hidden: false },
        { name: 'mixed', args: ['()[]{}'], expected: true, hidden: false },
        { name: 'invalid', args: ['(]'], expected: false, hidden: true },
        { name: 'nested', args: ['{[]}'], expected: true, hidden: true },
      ],
    },
  ];

  for (const c of challenges) {
    const exists = await prisma.codingChallenge.findFirst({
      where: { companyId: company.id, title: c.title },
    });
    if (!exists) {
      await prisma.codingChallenge.create({
        data: { companyId: company.id, ...c },
      });
    } else if (!exists.testCases) {
      await prisma.codingChallenge.update({
        where: { id: exists.id },
        data: { testCases: c.testCases, starterCode: c.starterCode },
      });
    }
  }

  const engPath = await prisma.learningPath.findFirst({
    where: { companyId: company.id, title: 'Full-Stack Engineering Foundations' },
  });

  const certs = [
    { title: 'Workplace Safety Certification', description: 'Mandatory annual safety training', isMandatory: true, validMonths: 12, pathId: null },
    { title: 'React Developer Certificate', description: 'Complete all Full-Stack Engineering modules', isMandatory: false, validMonths: 24, pathId: engPath?.id ?? null },
  ];

  for (const cert of certs) {
    const exists = await prisma.certification.findFirst({
      where: { companyId: company.id, title: cert.title },
    });
    if (!exists) {
      await prisma.certification.create({ data: { companyId: company.id, ...cert } });
    } else if (cert.pathId && !exists.pathId) {
      await prisma.certification.update({ where: { id: exists.id }, data: { pathId: cert.pathId } });
    }
  }

  const materials = [
    {
      title: 'React Hooks Overview',
      track: 'ENGINEERING',
      description: 'Internal tutorial on useState, useEffect, and custom hooks',
      content: 'useState stores component state. useEffect runs side effects after render. Custom hooks extract reusable logic. Prefer hooks over class components in new React code.',
    },
    {
      title: 'TypeScript for Teams',
      track: 'ENGINEERING',
      description: 'Typing patterns for NestJS and Next.js',
      content: 'Use interfaces for object shapes, generics for reusable utilities, and strict mode. Avoid any. Prefer unknown for external data then narrow with type guards.',
    },
  ];

  for (const m of materials) {
    const exists = await prisma.learningMaterial.findFirst({
      where: { companyId: company.id, title: m.title },
    });
    if (!exists) {
      await prisma.learningMaterial.create({ data: { companyId: company.id, ...m } });
    }
  }

  console.log('  Learning paths, challenges, and certifications seeded');
}

async function seedCompanyPolicies(company) {
  const policies = [
    {
      title: 'Work From Home Policy',
      category: 'WFH',
      sortOrder: 1,
      content: `Weather-based WFH is decided daily by HR based on office weather and employee commute distance.

• HR reviews eligible employees each morning after the weather check.
• HR may allow or not allow WFH per person — important on-site work may require office attendance.
• Employees must check in remotely from Attendance when working from home.
• WFH is a privilege, not an automatic right, even when weather conditions are severe.`,
    },
    {
      title: 'Attendance & Office Hours',
      category: 'ATTENDANCE',
      sortOrder: 2,
      content: `Standard office hours: 9:00 AM – 5:00 PM, Monday to Friday (Asia/Karachi).

• Employees must check in and out via the Attendance page each workday.
• Multiple sessions per day are supported (e.g. lunch breaks).
• Late arrivals are tracked; repeated lateness may be reviewed by HR.
• Remote check-in is only permitted when HR has explicitly allowed WFH for that day.`,
    },
    {
      title: 'Leave & Time Off',
      category: 'LEAVE',
      sortOrder: 3,
      content: `Submit leave requests through the Leave page before your absence.

• Approved leave is reflected in attendance automatically.
• Work-from-home leave days are separate from weather-based WFH.
• Emergency leave should be reported to your manager and HR as soon as possible.`,
    },
    {
      title: 'Equipment & Asset Care',
      category: 'EQUIPMENT',
      sortOrder: 4,
      content: `Company laptops and equipment remain company property.

• Report damage, loss, or repair needs promptly via My Equipment.
• Return all assets on your last working day or when reassigned.
• Do not install unapproved software on company devices.`,
    },
  ];

  for (const spec of policies) {
    const existing = await prisma.companyPolicy.findFirst({
      where: { companyId: company.id, title: spec.title },
    });
    if (existing) {
      await prisma.companyPolicy.update({
        where: { id: existing.id },
        data: spec,
      });
    } else {
      await prisma.companyPolicy.create({
        data: { companyId: company.id, ...spec },
      });
    }
  }
}

async function seedWeatherAndAssets(company, employees) {
  await prisma.weatherSettings.upsert({
    where: { companyId: company.id },
    update: { enabled: true, minDistanceKm: 20, checkHour: 6, heatThresholdC: 30, autoApproveWfh: false, requireManagerApproval: true },
    create: { companyId: company.id, enabled: true, minDistanceKm: 20, checkHour: 6, heatThresholdC: 30, autoApproveWfh: false, requireManagerApproval: true },
  });

  const longCommuteProfiles = [
    { email: 'employee@acme.com', address: 'Bahria Town, Lahore', city: 'Lahore', lat: 31.367, lng: 74.188, km: 28.4, min: 52 },
    { email: 'john@acme.com', address: 'Raiwind Road, Lahore', city: 'Lahore', lat: 31.248, lng: 74.215, km: 32.1, min: 58 },
    { email: 'emma.wilson@acme.com', address: 'Shahdara, Lahore', city: 'Lahore', lat: 31.595, lng: 74.285, km: 22.6, min: 42 },
    { email: 'michael.chen@acme.com', address: 'DHA Phase 8, Lahore', city: 'Lahore', lat: 31.428, lng: 74.452, km: 26.3, min: 48 },
    { email: 'olivia.brown@acme.com', address: 'Ferozepur Road, Lahore', city: 'Lahore', lat: 31.408, lng: 74.372, km: 24.0, min: 45 },
    { email: 'james.taylor@acme.com', address: 'Lake City, Lahore', city: 'Lahore', lat: 31.392, lng: 74.258, km: 21.2, min: 40 },
    { email: 'sophia.martinez@acme.com', address: 'Multan Road, Lahore', city: 'Lahore', lat: 31.382, lng: 74.292, km: 23.5, min: 44 },
    { email: 'william.garcia@acme.com', address: 'GT Road, Lahore', city: 'Lahore', lat: 31.521, lng: 74.402, km: 27.8, min: 50 },
    { email: 'ava.rodriguez@acme.com', address: 'Valencia Town, Lahore', city: 'Lahore', lat: 31.415, lng: 74.165, km: 31.5, min: 55 },
    { email: 'benjamin.lee@acme.com', address: 'Thokar Niaz Baig, Lahore', city: 'Lahore', lat: 31.436, lng: 74.207, km: 25.2, min: 46 },
    { email: 'isabella.walker@acme.com', address: 'Gulberg III, Lahore', city: 'Lahore', lat: 31.52, lng: 74.348, km: 22.4, min: 41 },
    { email: 'lucas.hall@acme.com', address: 'Cantt, Lahore', city: 'Lahore', lat: 31.532, lng: 74.378, km: 25.6, min: 47 },
    { email: 'mia.allen@acme.com', address: 'Barki Road, Lahore', city: 'Lahore', lat: 31.558, lng: 74.418, km: 29.8, min: 54 },
    { email: 'henry.young@acme.com', address: 'Kasur Road, Lahore', city: 'Lahore', lat: 31.365, lng: 74.355, km: 27.2, min: 49 },
    { email: 'charlotte.king@acme.com', address: 'Sundar, Lahore', city: 'Lahore', lat: 31.335, lng: 74.265, km: 26.1, min: 48 },
  ];

  for (const profile of longCommuteProfiles) {
    const row = employees.find((e) => e.user?.email === profile.email);
    if (!row?.employee) continue;
    await prisma.employee.update({
      where: { id: row.employee.id },
      data: {
        address: profile.address,
        city: profile.city,
        homeCountry: 'Pakistan',
        latitude: profile.lat,
        longitude: profile.lng,
        commuteDistanceKm: profile.km,
        commuteDurationMin: profile.min,
      },
    });
  }

  const jane = employees.find((e) => e.user?.email === 'employee@acme.com');

  const assets = [
    { assetTag: 'LAP-001', name: 'MacBook Pro 14"', category: 'LAPTOP', serialNumber: 'MBP-2024-001' },
    { assetTag: 'LAP-002', name: 'Dell Latitude 5540', category: 'LAPTOP', serialNumber: 'DL-5540-002' },
    { assetTag: 'MON-001', name: 'Dell UltraSharp 27"', category: 'MONITOR', serialNumber: 'DU-27-001' },
    { assetTag: 'HS-001', name: 'Jabra Evolve2', category: 'HEADSET', serialNumber: 'JB-EV2-001' },
  ];

  for (const spec of assets) {
    const asset = await prisma.asset.upsert({
      where: { companyId_assetTag: { companyId: company.id, assetTag: spec.assetTag } },
      update: { name: spec.name },
      create: {
        companyId: company.id,
        ...spec,
        status: 'AVAILABLE',
        condition: 'GOOD',
      },
    });

    await prisma.assetAuditLog.create({
      data: {
        assetId: asset.id,
        action: 'CREATED',
        newValue: { assetTag: spec.assetTag },
        reason: 'Seed data',
      },
    });
  }

  if (jane?.employee) {
    const laptop = await prisma.asset.findUnique({
      where: { companyId_assetTag: { companyId: company.id, assetTag: 'LAP-001' } },
    });
    if (laptop && laptop.status === 'AVAILABLE') {
      await prisma.assetAssignment.create({
        data: {
          assetId: laptop.id,
          employeeId: jane.employee.id,
          conditionAtAssignment: 'GOOD',
          notes: 'Standard issue laptop',
        },
      });
      await prisma.asset.update({
        where: { id: laptop.id },
        data: { status: 'ASSIGNED' },
      });
    }

    const monitor = await prisma.asset.findUnique({
      where: { companyId_assetTag: { companyId: company.id, assetTag: 'MON-001' } },
    });
    if (monitor && monitor.status === 'AVAILABLE') {
      await prisma.assetAssignment.create({
        data: {
          assetId: monitor.id,
          employeeId: jane.employee.id,
          conditionAtAssignment: 'GOOD',
        },
      });
      await prisma.asset.update({
        where: { id: monitor.id },
        data: { status: 'ASSIGNED' },
      });
    }
  }

  await seedLiveWeatherAlerts(company);
}

/** Fetch live weather and seed today's alerts when OPENWEATHER_API_KEY is set */
async function seedLiveWeatherAlerts(company) {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey || !company.officeLatitude || !company.officeLongitude) {
    console.log('  ⏭ Weather alerts: add OPENWEATHER_API_KEY to .env and re-run db:seed');
    return;
  }

  try {
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.searchParams.set('lat', String(company.officeLatitude));
    url.searchParams.set('lon', String(company.officeLongitude));
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'metric');

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.log(`  ⚠ OpenWeather returned ${res.status} — seeding demo weather alerts for UI testing`);
      await seedDemoWeatherAlerts(company);
      return;
    }

    const data = await res.json();
    const w = data.weather?.[0];
    const temp = Math.round(data.main.temp * 10) / 10;
    const windKmh = Math.round(data.wind.speed * 3.6);
    const rain1h = data.rain?.['1h'] ?? 0;
    const main = w?.main ?? '';
    const desc = (w?.description ?? '').toLowerCase();

    const conditions = [];
    if (main === 'Thunderstorm') conditions.push('THUNDERSTORM');
    if (main === 'Rain' || rain1h > 0) conditions.push('HEAVY_RAIN');
    if (main === 'Snow') conditions.push('SNOW');
    if (desc.includes('flood')) conditions.push('FLOOD_WARNING');

    const settings = await prisma.weatherSettings.findUnique({ where: { companyId: company.id } });
    const minKm = settings?.minDistanceKm ?? 20;
    const heatThreshold = settings?.heatThresholdC ?? 30;
    const coldThreshold = settings?.coldThresholdC ?? 2;
    const windThreshold = settings?.windThresholdKmh ?? 60;

    if (temp >= heatThreshold) conditions.push('HEAT_WAVE');
    if (temp <= coldThreshold) conditions.push('EXTREME_COLD');
    if (windKmh >= windThreshold) conditions.push('HIGH_WIND');
    const hasSevereWeather = conditions.length > 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const staff = await prisma.employee.findMany({
      where: {
        companyId: company.id,
        employmentStatus: 'ACTIVE',
        commuteDistanceKm: { gte: minKm },
      },
      include: { user: true },
    });

    let eligible = 0;
    for (const emp of staff) {
      const isEligible = hasSevereWeather;
      const reason = isEligible
        ? `Severe weather: ${w?.description ?? main} (${temp}°C, wind ${windKmh} km/h)`
        : `No severe weather (${w?.description ?? main}, ${temp}°C)`;

      await prisma.weatherAlert.upsert({
        where: { employeeId_date: { employeeId: emp.id, date: today } },
        create: {
          companyId: company.id,
          employeeId: emp.id,
          date: today,
          eligible: isEligible,
          conditions,
          reason,
          distanceKm: emp.commuteDistanceKm,
          temperatureC: temp,
          weatherSnapshot: { description: w?.description, main, temp, windKmh, rain1h },
        },
        update: {
          eligible: isEligible,
          conditions,
          reason,
          distanceKm: emp.commuteDistanceKm,
          temperatureC: temp,
          weatherSnapshot: { description: w?.description, main, temp, windKmh, rain1h },
        },
      });

      if (isEligible) {
        eligible++;
        const existing = await prisma.notification.findFirst({
          where: {
            userId: emp.userId,
            type: 'WEATHER_ALERT',
            sentAt: { gte: today },
          },
        });
        if (!existing) {
          const notif = await prisma.notification.create({
            data: {
              userId: emp.userId,
              type: 'WEATHER_ALERT',
              title: 'Weather Alert',
              message: `Due to today's weather (${w?.description}) and your ${emp.commuteDistanceKm?.toFixed(1)} km commute, you may work from home. Check your dashboard.`,
            },
          });
          await prisma.weatherAlert.update({
            where: { employeeId_date: { employeeId: emp.id, date: today } },
            data: { notificationId: notif.id },
          });
        }
      }
    }

    await prisma.weatherRecommendation.upsert({
      where: { companyId_date: { companyId: company.id, date: today } },
      create: {
        companyId: company.id,
        date: today,
        content: `Current office weather: ${w?.description} (${temp}°C). ${eligible} of ${staff.length} long-commute employees eligible for weather WFH today.`,
        metadata: { temp, conditions, staffCount: staff.length, eligible },
      },
      update: {
        content: `Current office weather: ${w?.description} (${temp}°C). ${eligible} of ${staff.length} long-commute employees eligible for weather WFH today.`,
        metadata: { temp, conditions, staffCount: staff.length, eligible },
      },
    });

    console.log(`  🌦 Live weather seeded: ${w?.description}, ${temp}°C — ${eligible}/${staff.length} eligible for WFH`);
  } catch (err) {
    console.log(`  ⚠ Weather seed failed: ${err.message} — using demo alerts`);
    await seedDemoWeatherAlerts(company);
  }
}

/** Demo alerts when live API is unavailable (invalid key, activation pending, etc.) */
async function seedDemoWeatherAlerts(company) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const demoWeather = {
    description: 'heavy intensity rain',
    main: 'Rain',
    temperatureC: 8.4,
    feelsLikeC: 6.1,
    humidity: 88,
    windSpeedKmh: 42,
    rain1hMm: 6.2,
    icon: '09d',
    conditions: ['HEAVY_RAIN'],
    hasGovernmentAdvisory: false,
  };

  const settings = await prisma.weatherSettings.findUnique({ where: { companyId: company.id } });
  const minKm = settings?.minDistanceKm ?? 20;

  const staff = await prisma.employee.findMany({
    where: {
      companyId: company.id,
      employmentStatus: 'ACTIVE',
      commuteDistanceKm: { gte: minKm },
    },
    include: { user: true },
  });

  let eligible = 0;
  for (const emp of staff) {
    await prisma.weatherAlert.upsert({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
      create: {
        companyId: company.id,
        employeeId: emp.id,
        date: today,
        eligible: true,
        conditions: ['HEAVY_RAIN'],
        reason: `Demo: Heavy rain and ${emp.commuteDistanceKm?.toFixed(1)} km commute`,
        distanceKm: emp.commuteDistanceKm,
        temperatureC: demoWeather.temperatureC,
        weatherSnapshot: demoWeather,
      },
      update: {
        eligible: true,
        conditions: ['HEAVY_RAIN'],
        reason: `Demo: Heavy rain and ${emp.commuteDistanceKm?.toFixed(1)} km commute`,
        distanceKm: emp.commuteDistanceKm,
        temperatureC: demoWeather.temperatureC,
        weatherSnapshot: demoWeather,
      },
    });
    eligible++;

    const existing = await prisma.notification.findFirst({
      where: { userId: emp.userId, type: 'WEATHER_ALERT', sentAt: { gte: today } },
    });
    if (!existing) {
      const notif = await prisma.notification.create({
        data: {
          userId: emp.userId,
          type: 'WEATHER_ALERT',
          title: 'Weather Alert',
          message: `Demo: Heavy rain today. Your ${emp.commuteDistanceKm?.toFixed(1)} km commute qualifies you for WFH. Check your dashboard.`,
        },
      });
      await prisma.weatherAlert.update({
        where: { employeeId_date: { employeeId: emp.id, date: today } },
        data: { notificationId: notif.id },
      });
    }
  }

  await prisma.weatherRecommendation.upsert({
    where: { companyId_date: { companyId: company.id, date: today } },
    create: {
      companyId: company.id,
      date: today,
      content: `Demo: Heavy rain expected near the office (${demoWeather.temperatureC}°C). ${eligible} employees with commutes over ${minKm} km should consider WFH.`,
      metadata: { demo: true, eligible, staffCount: staff.length },
    },
    update: {
      content: `Demo: Heavy rain expected near the office (${demoWeather.temperatureC}°C). ${eligible} employees with commutes over ${minKm} km should consider WFH.`,
      metadata: { demo: true, eligible, staffCount: staff.length },
    },
  });

  console.log(`  🌦 Demo weather alerts seeded for ${eligible} long-commute employees (use Run check when API key is active)`);
}

async function main() {
  console.log('\n🌱 Seeding Nura demo data...\n');

  // --- Super admin (no company) ---
  await upsertUser(ACCOUNTS.superAdmin);

  // --- Demo company ---
  let company = await prisma.company.findFirst({ where: { name: COMPANY.name } });
  if (!company) {
    company = await prisma.company.create({ data: COMPANY });
  } else {
    company = await prisma.company.update({ where: { id: company.id }, data: COMPANY });
  }

  const existingSub = await prisma.subscription.findFirst({ where: { companyId: company.id } });
  if (!existingSub) {
    await prisma.subscription.create({
      data: { companyId: company.id, plan: 'PRO', status: 'ACTIVE' },
    });
  } else {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { plan: 'PRO', status: 'ACTIVE' },
    });
  }

  await prisma.wellnessScoreConfig.upsert({
    where: { companyId: company.id },
    update: {},
    create: { companyId: company.id },
  });

  await prisma.weatherSettings.upsert({
    where: { companyId: company.id },
    update: {},
    create: { companyId: company.id },
  });

  const engineering = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Engineering' } },
    update: {},
    create: { companyId: company.id, name: 'Engineering' },
  });

  const hrDept = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Human Resources' } },
    update: {},
    create: { companyId: company.id, name: 'Human Resources' },
  });

  const sales = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Sales' } },
    update: {},
    create: { companyId: company.id, name: 'Sales' },
  });

  const marketing = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Marketing' } },
    update: {},
    create: { companyId: company.id, name: 'Marketing' },
  });

  const operations = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Operations' } },
    update: {},
    create: { companyId: company.id, name: 'Operations' },
  });

  const finance = await prisma.department.upsert({
    where: { companyId_name: { companyId: company.id, name: 'Finance' } },
    update: {},
    create: { companyId: company.id, name: 'Finance' },
  });

  const deptMap = {
    Engineering: engineering.id,
    'Human Resources': hrDept.id,
    Sales: sales.id,
    Marketing: marketing.id,
    Operations: operations.id,
    Finance: finance.id,
  };

  const employeePasswordHash = await bcrypt.hash(EMPLOYEE_PASSWORD, 12);

  // --- Company admin (HR) ---
  const adminUser = await upsertUser({ ...ACCOUNTS.companyAdmin, companyId: company.id });

  // --- 30 employees ---
  const roster = [
    {
      email: ACCOUNTS.employee.email,
      firstName: ACCOUNTS.employee.firstName,
      lastName: ACCOUNTS.employee.lastName,
      dept: 'Engineering',
      position: 'Software Engineer',
      gender: 'FEMALE',
      age: 29,
      tier: 'healthy',
    },
    {
      email: ACCOUNTS.employee2.email,
      firstName: ACCOUNTS.employee2.firstName,
      lastName: ACCOUNTS.employee2.lastName,
      dept: 'Engineering',
      position: 'Product Manager',
      gender: 'MALE',
      age: 34,
      tier: 'at-risk',
    },
    ...EXTRA_EMPLOYEES.map(([firstName, lastName, dept, position, gender, age], i) => ({
      email: emailFor(firstName, lastName),
      firstName,
      lastName,
      dept,
      position,
      gender,
      age,
      tier: i % 5 === 0 ? 'at-risk' : i % 3 === 0 ? 'healthy' : 'moderate',
    })),
  ];

  const seededEmployees = [];

  for (let i = 0; i < roster.length; i++) {
    const person = roster[i];
    const user = await upsertUser({
      email: person.email,
      passwordHash: employeePasswordHash,
      firstName: person.firstName,
      lastName: person.lastName,
      role: 'EMPLOYEE',
      companyId: company.id,
    });

    const employee = await upsertEmployee(user.id, company.id, deptMap[person.dept], {
      position: person.position,
      gender: person.gender,
      age: person.age,
      height: 160 + (i % 25),
      weight: 55 + (i % 35),
      exerciseFrequency: person.tier === 'healthy' ? 'MODERATE' : person.tier === 'at-risk' ? 'NONE' : 'LIGHT',
      smokingStatus: i % 17 === 0 ? 'FORMER' : 'NEVER',
      alcoholConsumption: ['NONE', 'OCCASIONAL', 'MODERATE'][i % 3],
      employeeNumber: `EMP-${String(i + 1).padStart(4, '0')}`,
      joiningDate: daysAgo(400 + i * 12),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      baseSalary: 4500 + (i % 20) * 250,
      phoneNumber: `+1-555-${String(1000 + i).slice(-4)}`,
      team: person.dept,
    });

    await seedCheckins(employee.id, checkinPatternForTier(person.tier, i), 14);
    await seedHealthMetrics(
      employee.id,
      55 + (i % 35),
      checkinPatternForTier(person.tier, i),
      14,
    );
    seededEmployees.push({ user, employee, person });

    if ((i + 1) % 10 === 0) {
      console.log(`  … ${i + 1}/${roster.length} employees seeded`);
    }
  }

  const jane = seededEmployees[0].employee;
  const john = seededEmployees[1].employee;
  const janeUser = seededEmployees[0].user;
  const johnUser = seededEmployees[1].user;

  // --- Goals & achievements ---
  await prisma.goal.deleteMany({ where: { employeeId: { in: [jane.id, john.id] } } });
  await prisma.achievement.deleteMany({ where: { employeeId: { in: [jane.id, john.id] } } });

  await prisma.goal.createMany({
    data: [
      {
        employeeId: jane.id,
        title: 'Walk 10,000 steps daily',
        targetValue: 10000,
        currentValue: 7200,
        unit: 'steps',
        deadline: daysAgo(-30),
      },
      {
        employeeId: john.id,
        title: 'Sleep 7+ hours nightly',
        targetValue: 7,
        currentValue: 5.2,
        unit: 'hours',
        deadline: daysAgo(-14),
      },
      {
        employeeId: john.id,
        title: 'Drink 2L water daily',
        targetValue: 2,
        currentValue: 1.2,
        unit: 'liters',
        deadline: daysAgo(-7),
      },
    ],
  });

  await prisma.achievement.createMany({
    data: [
      {
        employeeId: jane.id,
        title: '7-Day Check-in Streak',
        description: 'Checked in every day for a week',
        icon: '🔥',
      },
      {
        employeeId: jane.id,
        title: 'Hydration Hero',
        description: 'Met water intake goal 5 days in a row',
        icon: '💧',
      },
      {
        employeeId: john.id,
        title: 'First Check-in',
        description: 'Completed your first wellness check-in',
        icon: '✅',
      },
    ],
  });

  // --- Company expenses ---
  const expenseCount = await prisma.expense.count({ where: { companyId: company.id } });
  if (expenseCount < 3) {
    await prisma.expense.createMany({
      data: [
        {
          companyId: company.id,
          category: 'INSURANCE',
          amount: 45000,
          description: 'Q2 group health insurance premium',
          department: 'Company-wide',
          date: daysAgo(45),
        },
        {
          companyId: company.id,
          category: 'GYM_MEMBERSHIP',
          amount: 3200,
          description: 'Corporate gym partnership',
          department: 'Engineering',
          date: daysAgo(20),
        },
        {
          companyId: company.id,
          category: 'MENTAL_HEALTH',
          amount: 8500,
          description: 'EAP counseling program',
          department: 'Human Resources',
          date: daysAgo(10),
        },
        {
          companyId: company.id,
          category: 'WELLNESS_BUDGET',
          amount: 5000,
          description: 'Wellness challenge prizes',
          department: 'Company-wide',
          date: daysAgo(5),
        },
      ],
      skipDuplicates: true,
    });
  }

  // --- Notifications ---
  for (const user of [janeUser, johnUser, adminUser]) {
    const count = await prisma.notification.count({ where: { userId: user.id } });
    if (count === 0) {
      await prisma.notification.createMany({
        data: [
          {
            userId: user.id,
            type: 'MORNING_CHECKIN',
            title: 'Good morning!',
            message: 'Time for your daily wellness check-in.',
            read: false,
          },
          {
            userId: user.id,
            type: 'WEEKLY_SUMMARY',
            title: 'Your weekly wellness summary',
            message: 'You checked in 5 times this week. Keep it up!',
            read: true,
            readAt: new Date(),
          },
        ],
      });
    }
  }

  // --- AI insights ---
  const insightCount = await prisma.aiInsight.count({ where: { companyId: company.id } });
  if (insightCount === 0) {
    await prisma.aiInsight.createMany({
      data: [
        {
          companyId: company.id,
          scope: 'company',
          title: 'Sleep trends declining in Engineering',
          content:
            'Average sleep in Engineering dropped 45 minutes this month. Consider a sleep hygiene workshop.',
        },
        {
          companyId: company.id,
          scope: 'company',
          title: 'Check-in engagement up 12%',
          content: 'More employees completed daily check-ins compared to last month.',
        },
        {
          employeeId: jane.id,
          companyId: company.id,
          scope: 'employee',
          title: 'Great exercise consistency',
          content: 'You exercised 5 days this week. Excellent consistency!',
        },
        {
          employeeId: john.id,
          companyId: company.id,
          scope: 'employee',
          title: 'Sleep needs attention',
          content: 'Your average sleep is 5.4 hours. Aim for 7–9 hours for better recovery.',
        },
      ],
    });
  }

  // --- Sample chat session for employee ---
  const chatCount = await prisma.chatSession.count({ where: { userId: janeUser.id } });
  if (chatCount === 0) {
    await prisma.chatSession.create({
      data: {
        userId: janeUser.id,
        title: 'Sleep and stress tips',
        messages: {
          create: [
            { role: 'user', content: 'How can I improve my sleep quality?' },
            {
              role: 'assistant',
              content:
                'Try keeping a consistent bedtime, limiting screens 1 hour before bed, and aiming for 7–9 hours. A short walk after dinner can also help.',
            },
          ],
        },
      },
    });
  }

  // --- Second company for super-admin list ---
  await seedHrmData(company, seededEmployees, adminUser);
  await seedWeatherAndAssets(company, seededEmployees);
  await seedCompanyPolicies(company);
  await seedLearningData(company);
  await seedEmailTemplates(company);

  const globexExists = await prisma.company.findFirst({ where: { name: 'Globex Industries' } });
  if (!globexExists) {
    await prisma.company.create({
      data: {
        name: 'Globex Industries',
        industry: 'Manufacturing',
        country: 'Canada',
        employeeCount: 120,
        healthcareBudget: 500000,
        subscriptions: { create: { plan: 'ENTERPRISE', status: 'ACTIVE' } },
        wellnessConfig: { create: {} },
      },
    });
  }

  console.log(`  ${seededEmployees.length} employees at Acme Corporation`);
  console.log('✅ Demo data seeded successfully!\n');
  console.log('═'.repeat(60));
  console.log('  LOGIN CREDENTIALS (http://localhost:4000/login)');
  console.log('═'.repeat(60));
  console.log('');
  console.log('  SUPER ADMIN — Platform management (/superadmin/*)');
  console.log(`    Email:    ${ACCOUNTS.superAdmin.email}`);
  console.log(`    Password: ${ACCOUNTS.superAdmin.password}`);
  console.log('');
  console.log('  COMPANY ADMIN (HR) — Company dashboards (/admin/*)');
  console.log(`    Email:    ${ACCOUNTS.companyAdmin.email}`);
  console.log(`    Password: ${ACCOUNTS.companyAdmin.password}`);
  console.log('');
  console.log('  EMPLOYEE #1 — Healthy profile (Jane)');
  console.log(`    Email:    ${ACCOUNTS.employee.email}`);
  console.log(`    Password: ${EMPLOYEE_PASSWORD}`);
  console.log('');
  console.log('  EMPLOYEE #2 — Needs improvement (John)');
  console.log(`    Email:    ${ACCOUNTS.employee2.email}`);
  console.log(`    Password: ${EMPLOYEE_PASSWORD}`);
  console.log('');
  console.log(`  ALL OTHER STAFF (${TOTAL_EMPLOYEES - 2} more) — same password`);
  console.log(`    Password: ${EMPLOYEE_PASSWORD}`);
  console.log('    Email format: firstname.lastname@acme.com');
  console.log('    Examples:    emma.wilson@acme.com, michael.chen@acme.com');
  console.log('');
  console.log('═'.repeat(60));
  console.log('');
  console.log('  What each role can access:');
  console.log('  • Super Admin  → /superadmin/dashboard, companies, users, logs');
  console.log('  • HR Admin     → /admin/dashboard, employees, spending, reports');
  console.log('  • Employee     → /dashboard, check-in, AI coach, health, documents');
  console.log('');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
