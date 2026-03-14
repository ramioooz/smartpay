import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export type PspHealthSummary = {
  pspName: string;
  successRate: number;
  averageLatencyMs: number;
  total: number;
  lastFailureAt?: Date;
  lastFailureReason?: string;
};

export class PspHealthTracker {
  async getLatest(pspName: string): Promise<PspHealthSummary | null> {
    const record = await prisma.pspHealth.findFirst({
      where: { pspName },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    const total = record.successCount + record.failureCount;
    const successRate = total > 0 ? record.successCount / total : 1;

    return {
      pspName,
      successRate,
      averageLatencyMs: Number(record.averageLatencyMs),
      total,
      lastFailureAt: record.lastFailureAt ?? undefined,
      lastFailureReason: record.lastFailureReason ?? undefined,
    };
  }

  async recordOutcome(input: {
    pspName: string;
    success: boolean;
    latencyMs: number;
    failureReason?: string;
  }): Promise<void> {
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - 60 * 60 * 1000);

    const latest = await prisma.pspHealth.findFirst({
      where: {
        pspName: input.pspName,
        windowStart: { gte: windowStart },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      await prisma.pspHealth.create({
        data: {
          pspName: input.pspName,
          successCount: input.success ? 1 : 0,
          failureCount: input.success ? 0 : 1,
          averageLatencyMs: new Prisma.Decimal(input.latencyMs),
          lastFailureAt: input.success ? null : new Date(),
          lastFailureReason: input.success ? null : input.failureReason,
          windowStart,
          windowEnd,
        },
      });
      return;
    }

    const nextSuccess = latest.successCount + (input.success ? 1 : 0);
    const nextFailure = latest.failureCount + (input.success ? 0 : 1);
    const total = nextSuccess + nextFailure;
    const prevTotal = latest.successCount + latest.failureCount;
    const nextAvg = (Number(latest.averageLatencyMs) * prevTotal + input.latencyMs) / total;

    await prisma.pspHealth.update({
      where: { id: latest.id },
      data: {
        successCount: nextSuccess,
        failureCount: nextFailure,
        averageLatencyMs: new Prisma.Decimal(nextAvg),
        lastFailureAt: input.success ? latest.lastFailureAt : new Date(),
        lastFailureReason: input.success ? latest.lastFailureReason : input.failureReason,
        windowEnd,
      },
    });
  }
}

export const pspHealthTracker = new PspHealthTracker();
