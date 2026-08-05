import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WeatherEngineService } from './weather-engine.service';

@Injectable()
export class WeatherSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeatherSchedulerService.name);
  private interval?: ReturnType<typeof setInterval>;

  constructor(private weatherEngine: WeatherEngineService) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      this.weatherEngine.runDailyCheckAllCompanies().catch((err) => {
        this.logger.error(`Scheduled weather check failed: ${err}`);
      });
    }, 60_000);
    this.logger.log('Weather scheduler started (checks every minute for 6 AM local time)');
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }
}
