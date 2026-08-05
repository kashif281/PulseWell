import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyPolicyService } from './company-policy.service';
import { CompanyController } from './company.controller';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [EmployeesModule],
  controllers: [CompanyController],
  providers: [CompanyService, CompanyPolicyService],
  exports: [CompanyService, CompanyPolicyService],
})
export class CompanyModule {}
