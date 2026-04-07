import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from './api.module';
import { NotificationBootstrapCron } from './notification-bootstrap.cron';

@Module({
  imports: [ScheduleModule.forRoot(), ApiModule],
  providers: [NotificationBootstrapCron],
})
export class AppModule {}
