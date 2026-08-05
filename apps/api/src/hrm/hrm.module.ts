import { Module } from '@nestjs/common';
import { HrmController } from './hrm.controller';
import { AttendanceService } from './attendance.service';
import { LeaveService } from './leave.service';
import { PayrollService } from './payroll.service';
import { ApprovalsService, HrmDashboardService } from './hrm-dashboard.service';
import { AttendanceEventsService } from './attendance-events.service';
import { CompanyActivityService } from './company-activity.service';

@Module({
  controllers: [HrmController],
  providers: [
    AttendanceService,
    LeaveService,
    PayrollService,
    ApprovalsService,
    HrmDashboardService,
    AttendanceEventsService,
    CompanyActivityService,
  ],
  exports: [AttendanceService, LeaveService, PayrollService, HrmDashboardService],
})
export class HrmModule {}
