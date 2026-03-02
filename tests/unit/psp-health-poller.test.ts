const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();

const retryMock = jest.fn();
const recordOutcomeMock = jest.fn();

jest.mock('@smartpay/shared', () => ({
  createLogger: jest.fn(() => ({
    info: loggerInfoMock,
    warn: loggerWarnMock,
  })),
  retry: (...args: unknown[]) => retryMock(...args),
}));

jest.mock('../../packages/routing-srv/src/config', () => ({
  config: {
    PAYMENT_SRV_URL: 'http://payment-srv:3001',
    ROUTING_HEALTH_POLL_INTERVAL_MS: 1000,
    ROUTING_HEALTH_POLL_TIMEOUT_MS: 5000,
    ROUTING_HEALTH_POLL_RETRIES: 2,
    ROUTING_HEALTH_POLL_BASE_DELAY_MS: 25,
  },
}));

jest.mock('../../packages/routing-srv/src/services/psp-health-tracker', () => ({
  pspHealthTracker: {
    recordOutcome: recordOutcomeMock,
  },
}));

import {
  runPspHealthPollCycle,
  startPspHealthPoller,
  stopPspHealthPoller,
} from '../../packages/routing-srv/src/services/psp-health-poller';

describe('psp-health-poller', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await stopPspHealthPoller();
    jest.clearAllMocks();
    retryMock.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    recordOutcomeMock.mockResolvedValue(undefined);
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records adapter outcomes from payment health response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        service: 'payment-srv',
        adapters: [
          { name: 'stripe', healthy: true, latencyMs: 63 },
          { name: 'wise', healthy: false, latencyMs: 130 },
        ],
      }),
    });

    await runPspHealthPollCycle();

    expect(recordOutcomeMock).toHaveBeenCalledTimes(2);
    expect(recordOutcomeMock).toHaveBeenNthCalledWith(1, {
      pspName: 'stripe',
      success: true,
      latencyMs: 63,
      failureReason: undefined,
    });
    expect(recordOutcomeMock).toHaveBeenNthCalledWith(2, {
      pspName: 'wise',
      success: false,
      latencyMs: 130,
      failureReason: 'payment-srv health endpoint reported adapter unhealthy',
    });
  });

  it('uses fallback latency when adapter latency is missing or invalid', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        adapters: [
          { name: 'stripe', healthy: true },
          { name: 'checkout', healthy: true, latencyMs: 0 },
        ],
      }),
    });

    await runPspHealthPollCycle();

    expect(recordOutcomeMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ latencyMs: 150 }));
    expect(recordOutcomeMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ latencyMs: 150 }));
  });

  it('skips malformed payloads without recording outcomes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    await runPspHealthPollCycle();

    expect(recordOutcomeMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalled();
  });

  it('retries health fetch using shared retry helper', async () => {
    const first = new Error('temporary timeout');
    retryMock.mockImplementation(async (fn: () => Promise<unknown>) => {
      try {
        return await fn();
      } catch (_error) {
        return fn();
      }
    });
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(first)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          adapters: [{ name: 'stripe', healthy: true, latencyMs: 55 }],
        }),
      });

    await runPspHealthPollCycle();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(recordOutcomeMock).toHaveBeenCalledWith({
      pspName: 'stripe',
      success: true,
      latencyMs: 55,
      failureReason: undefined,
    });
  });

  it('runs immediate poll on start and stops scheduled polls', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        adapters: [{ name: 'stripe', healthy: true, latencyMs: 70 }],
      }),
    });

    await startPspHealthPoller();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    await stopPspHealthPoller();
    await jest.advanceTimersByTimeAsync(1000);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
