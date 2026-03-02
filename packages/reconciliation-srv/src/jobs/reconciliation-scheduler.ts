import cron, { ScheduledTask } from 'node-cron';
import { createLogger } from '@smartpay/shared';
import { config } from '../config';
import { transactionMatcher } from '../services/transaction-matcher';

const logger = createLogger({ service: 'reconciliation-srv', component: 'reconciliation-scheduler' });

const scheduledTasks: ScheduledTask[] = [];

export function startReconciliationScheduler(): void {
  const hourlyTask = cron.schedule(config.RECON_HOURLY_CRON, async () => {
    const now = new Date();
    const from = new Date(now.getTime() - config.RECON_DEFAULT_LOOKBACK_MINUTES * 60_000);
    try {
      await transactionMatcher.run({ from, to: now });
      logger.info({ from, to: now }, 'Hourly reconciliation completed');
    } catch (error) {
      logger.error({ error, from, to: now }, 'Hourly reconciliation failed');
    }
  });

  const dailyTask = cron.schedule(config.RECON_DAILY_CRON, async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    try {
      await transactionMatcher.run({ from, to });
      logger.info({ from, to }, 'Daily reconciliation completed');
    } catch (error) {
      logger.error({ error, from, to }, 'Daily reconciliation failed');
    }
  });

  scheduledTasks.push(hourlyTask, dailyTask);

  logger.info(
    {
      hourly: config.RECON_HOURLY_CRON,
      daily: config.RECON_DAILY_CRON,
    },
    'Reconciliation scheduler started',
  );
}

export function stopReconciliationScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop();
    task.destroy();
  }

  scheduledTasks.length = 0;
}
