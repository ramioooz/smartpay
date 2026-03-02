const createPaymentMock = jest.fn();

jest.mock('../../packages/payment-srv/src/services/orchestrator', () => ({
  paymentOrchestrator: {
    createPayment: createPaymentMock,
    getPaymentById: jest.fn(),
    initiateRefund: jest.fn(),
  },
}));

import { paymentController } from '../../packages/payment-srv/src/controllers/payment.controller';

function responseMock() {
  const res: {
    statusCode?: number;
    payload?: unknown;
    status: jest.Mock;
    json: jest.Mock;
  } = {
    status: jest.fn(function setStatus(code: number) {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(function setJson(payload: unknown) {
      res.payload = payload;
      return res;
    }),
  };

  return res;
}

describe('integration/psp-failover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns accepted failed response when adapter failover is exhausted', async () => {
    createPaymentMock.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      status: 'FAILED',
      failureReason: 'All configured PSP adapters failed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:03.000Z',
    });

    const req = {
      body: {
        merchantId: '123e4567-e89b-42d3-a456-426614174001',
        externalRef: 'ext-failover',
        amount: 1500,
        currency: 'USD',
        targetCurrency: 'AED',
        beneficiary: { name: 'Failover User', country: 'AE' },
      },
      requestId: 'req-failover',
    } as never;
    const res = responseMock();
    await paymentController.createPayment(req, res as never);

    expect(res.statusCode).toBe(202);
    expect((res.payload as { status: string }).status).toBe('FAILED');
    expect((res.payload as { failureReason: string }).failureReason).toContain('PSP adapters failed');
  });
});
