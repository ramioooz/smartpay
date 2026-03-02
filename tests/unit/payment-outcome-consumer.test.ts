const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();
const loggerDebugMock = jest.fn();

const consumerConnectMock = jest.fn();
const consumerSubscribeAndRunMock = jest.fn();
const consumerDisconnectMock = jest.fn();

const redisSetMock = jest.fn();
const recordOutcomeMock = jest.fn();

type KafkaHandler = (
  payload: Record<string, unknown>,
  message: { headers?: Record<string, Buffer> },
) => Promise<void>;

const handlersByTopic = new Map<string, KafkaHandler>();

jest.mock('@smartpay/shared', () => ({
  TOPICS: {
    PAYMENT_SETTLED: 'payment.settled',
    PAYMENT_FAILED: 'payment.failed',
  },
  createLogger: jest.fn(() => ({
    info: loggerInfoMock,
    warn: loggerWarnMock,
    debug: loggerDebugMock,
  })),
  createKafkaClient: jest.fn(() => ({
    consumer: jest.fn(() => ({})),
    producer: jest.fn(() => ({})),
  })),
  KafkaConsumer: jest.fn().mockImplementation(() => ({
    connect: consumerConnectMock,
    subscribeAndRun: async (
      options: { topic: string },
      handler: KafkaHandler,
    ) => {
      consumerSubscribeAndRunMock(options.topic);
      handlersByTopic.set(options.topic, handler);
    },
    disconnect: consumerDisconnectMock,
  })),
}));

jest.mock('../../packages/routing-srv/src/config', () => ({
  config: {
    kafkaBrokers: ['kafka:29092'],
  },
}));

jest.mock('../../packages/routing-srv/src/services/redis', () => ({
  getRedisClient: jest.fn(() => ({
    set: redisSetMock,
  })),
}));

jest.mock('../../packages/routing-srv/src/services/psp-health-tracker', () => ({
  pspHealthTracker: {
    recordOutcome: recordOutcomeMock,
  },
}));

import {
  startPaymentOutcomeConsumer,
  stopPaymentOutcomeConsumer,
} from '../../packages/routing-srv/src/consumers/payment-outcome.consumer';

describe('payment outcome consumer', () => {
  beforeEach(async () => {
    await stopPaymentOutcomeConsumer();
    jest.clearAllMocks();
    handlersByTopic.clear();
    redisSetMock.mockResolvedValue('OK');
    recordOutcomeMock.mockResolvedValue(undefined);
  });

  it('records settled events as successful outcomes', async () => {
    await startPaymentOutcomeConsumer();
    const settledHandler = handlersByTopic.get('payment.settled');
    expect(settledHandler).toBeDefined();

    await settledHandler!(
      {
        paymentId: 'payment-1',
        pspName: 'stripe',
        latencyMs: 87,
      },
      {
        headers: {
          'correlation-id': Buffer.from('corr-1'),
        },
      },
    );

    expect(recordOutcomeMock).toHaveBeenCalledWith({
      pspName: 'stripe',
      success: true,
      latencyMs: 87,
      failureReason: undefined,
    });
  });

  it('records failed events with fallback latency and reason', async () => {
    await startPaymentOutcomeConsumer();
    const failedHandler = handlersByTopic.get('payment.failed');
    expect(failedHandler).toBeDefined();

    await failedHandler!(
      {
        paymentId: 'payment-2',
        pspName: 'wise',
        reason: 'timeout',
      },
      {
        headers: {
          'x-request-id': Buffer.from('req-2'),
        },
      },
    );

    expect(recordOutcomeMock).toHaveBeenCalledWith({
      pspName: 'wise',
      success: false,
      latencyMs: 150,
      failureReason: 'timeout',
    });
  });

  it('skips duplicate events based on Redis dedupe key', async () => {
    redisSetMock.mockResolvedValueOnce(null);
    await startPaymentOutcomeConsumer();
    const failedHandler = handlersByTopic.get('payment.failed');
    expect(failedHandler).toBeDefined();

    await failedHandler!(
      {
        paymentId: 'payment-3',
        pspName: 'checkout',
        reason: 'declined',
      },
      {},
    );

    expect(recordOutcomeMock).not.toHaveBeenCalled();
    expect(loggerDebugMock).toHaveBeenCalled();
  });

  it('skips malformed events', async () => {
    await startPaymentOutcomeConsumer();
    const settledHandler = handlersByTopic.get('payment.settled');
    expect(settledHandler).toBeDefined();

    await settledHandler!(
      {
        paymentId: 'payment-4',
      },
      {},
    );

    expect(redisSetMock).not.toHaveBeenCalled();
    expect(recordOutcomeMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalled();
  });

  it('disconnects both consumers on stop', async () => {
    await startPaymentOutcomeConsumer();
    await stopPaymentOutcomeConsumer();

    expect(consumerDisconnectMock).toHaveBeenCalledTimes(2);
  });
});
