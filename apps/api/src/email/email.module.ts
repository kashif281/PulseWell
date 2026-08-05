import { Global, Module, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailsService } from './emails.service';
import { EmailsController } from './emails.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Global()
@Module({
  imports: [NotificationsModule, forwardRef(() => AiModule), IntegrationsModule],
  controllers: [EmailsController],
  providers: [EmailService, EmailsService],
  exports: [EmailService, EmailsService],
})
export class EmailModule {}
