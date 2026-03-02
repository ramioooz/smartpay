import { createLogger, retry } from '@smartpay/shared';
import { config } from '../config';
import { pspHealthTracker } from './psp-health-tracker';

const logger = createLogger({ service: 'routing-srv', component: 'psp-health-poller' });

const DEFAULT_LATENCY_MS = 150;

type PaymentSrvHealthPayload = {
  service?: string;
  adapters?: Array<{
    name?: string;
    healthy?: boolean;
    latencyMs?: number;
  }>;
};

type HttpError = Error & { statusCode?: number };

let pollInterval: NodeJS.Timeout | null = null;
let cycleInProgress = false;

function createHttpError(message: string, statusCode?: number): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

async function fetchPaymentHealth(): Promise<PaymentSrvHealthPayload> {
  const response = await retry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.ROUTING_HEALTH_POLL_TIMEOUT_MS);

      try {
        const result = await fetch(`${config.PAYMENT_SRV_URL}/health`, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!result.ok) {
          throw createHttpError(
            `payment-srv health endpoint returned ${result.status}`,
            result.status,
          );
        }

        return result;
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      maxRetries: config.ROUTING_HEALTH_POLL_RETRIES,
      baseDelayMs: config.ROUTING_HEALTH_POLL_BASE_DELAY_MS,
      shouldRetry: (error) => {
        const statusCode = (error as HttpError)?.statusCode;
        if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
          return false;
        }

        return true;
      },
    },
  );

  return (await response.json()) as PaymentSrvHealthPayload;
}

function normalizeLatency(latencyMs: unknown): number {
  return typeof latencyMs === 'number' && latencyMs > 0 ? latencyMs : DEFAULT_LATENCY_MS;
}

export async function runPspHealthPollCycle(): Promise<void> {
  if (cycleInProgress) {
    logger.warn('Skipping health poll cycle because previous cycle is still running');
    return;
  }

  cycleInProgress = true;
  try {
    const payload = await fetchPaymentHealth();
    if (!Array.isArray(payload.adapters)) {
      logger.warn({ payload }, 'Skipping payment-srv health payload without adapters array');
      return;
    }

    const trackedAdapters = payload.adapters.filter(
      (adapter): adapter is { name: string; healthy: boolean; latencyMs?: number } =>
        typeof adapter?.name === 'string' && typeof adapter?.healthy === 'boolean',
    );

    if (trackedAdapters.length === 0) {
      logger.warn('No valid adapter health entries were found in payment-srv response');
      return;
    }

    await Promise.all(
      trackedAdapters.map((adapter) =>
        pspHealthTracker.recordOutcome({
          pspName: adapter.name,
          success: adapter.healthy,
          latencyMs: normalizeLatency(adapter.latencyMs),
          failureReason: adapter.healthy
            ? undefined
            : 'payment-srv health endpoint reported adapter unhealthy',
        }),
      ),
    );

    logger.info(
      {
        service: payload.service ?? 'unknown',
        trackedAdapters: trackedAdapters.length,
      },
      'Completed PSP health polling cycle',
    );
  } catch (error) {
    logger.warn({ error }, 'PSP health polling cycle failed');
  } finally {
    cycleInProgress = false;
  }
}

export async function startPspHealthPoller(): Promise<void> {
  if (pollInterval) {
    return;
  }

  await runPspHealthPollCycle();
  pollInterval = setInterval(() => {
    void runPspHealthPollCycle();
  }, config.ROUTING_HEALTH_POLL_INTERVAL_MS);
}

export async function stopPspHealthPoller(): Promise<void> {
  if (!pollInterval) {
    return;
  }

  clearInterval(pollInterval);
  pollInterval = null;
}
