import { Module, forwardRef } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeeInvitationService } from './employee-invitation.service';
import { EmployeesController } from './employees.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeInvitationService],
  exports: [EmployeesService, EmployeeInvitationService],
})
export class EmployeesModule {}
