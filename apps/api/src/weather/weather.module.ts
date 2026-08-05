import { Module, forwardRef } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherEngineService } from './weather-engine.service';
import { WeatherApiService } from './weather-api.service';
import { WeatherRulesService } from './weather-rules.service';
import { WeatherSchedulerService } from './weather-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { HrmModule } from '../hrm/hrm.module';

@Module({
  imports: [NotificationsModule, forwardRef(() => HrmModule)],
  controllers: [WeatherController],
  providers: [
    WeatherEngineService,
    WeatherApiService,
    WeatherRulesService,
    WeatherSchedulerService,
  ],
  exports: [WeatherEngineService],
})
export class WeatherModule {}
