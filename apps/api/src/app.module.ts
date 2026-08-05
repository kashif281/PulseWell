import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { EmployeesModule } from './employees/employees.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SpendingModule } from './spending/spending.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';
import { HrmModule } from './hrm/hrm.module';
import { LocationModule } from './location/location.module';
import { WeatherModule } from './weather/weather.module';
import { AssetsModule } from './assets/assets.module';
import { AiModule } from './ai/ai.module';
import { LearningModule } from './learning/learning.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SecurityModule } from './common/security/security.module';
import { validateEnvironment } from './config/validate-env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../../../.env'), join(__dirname, '../.env'), '.env'],
      validate: validateEnvironment,
    }),
    SecurityModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    StorageModule,
    EmailModule,
    AuthModule,
    CompanyModule,
    EmployeesModule,
    DashboardModule,
    SpendingModule,
    NotificationsModule,
    SearchModule,
    AdminModule,
    HrmModule,
    LocationModule,
    WeatherModule,
    AssetsModule,
    AiModule,
    LearningModule,
    IntegrationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
