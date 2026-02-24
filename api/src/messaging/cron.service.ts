import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TriggerEvaluatorService } from '../messaging/trigger-evaluator.service';
import { NotificationDispatcherService } from '../messaging/notification-dispatcher.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private triggerEvaluator: TriggerEvaluatorService,
    private notificationDispatcher: NotificationDispatcherService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runDailyNotifications() {
    this.logger.log('Starting daily notification evaluation cycle...');
    const jobs = await this.triggerEvaluator.evaluate();
    
    this.logger.log(`Found ${jobs.length} notifications to dispatch.`);
    
    for (const job of jobs) {
      await this.notificationDispatcher.dispatch(job);
    }
    
    this.logger.log('Daily notification cycle complete.');
  }
}
