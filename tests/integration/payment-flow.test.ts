const createPaymentMock = jest.fn();
const getPaymentByIdMock = jest.fn();
const initiateRefundMock = jest.fn();

jest.mock('../../packages/payment-srv/src/services/orchestrator', () => ({
  paymentOrchestrator: {
    createPayment: createPaymentMock,
    getPaymentById: getPaymentByIdMock,
    initiateRefund: initiateRefundMock,
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

describe('integration/payment-flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates and reads settled payment through controller contract', async () => {
    const paymentId = '123e4567-e89b-42d3-a456-426614174100';
    createPaymentMock.mockResolvedValue({
      id: paymentId,
      status: 'SETTLED',
      pspName: 'stripe',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    });
    getPaymentByIdMock.mockResolvedValue({
      id: paymentId,
      status: 'SETTLED',
      pspName: 'stripe',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    });

    const createReq = {
      body: {
        merchantId: '123e4567-e89b-42d3-a456-426614174000',
        externalRef: 'ext-1',
        amount: 100,
        currency: 'USD',
        targetCurrency: 'EUR',
        beneficiary: { name: 'Jane Doe', country: 'DE' },
      },
      requestId: 'req-create',
    } as never;
    const createRes = responseMock();
    await paymentController.createPayment(createReq, createRes as never);

    expect(createRes.statusCode).toBe(201);
    expect((createRes.payload as { status: string }).status).toBe('SETTLED');

    const getReq = {
      params: { id: paymentId },
    } as never;
    const getRes = responseMock();
    await paymentController.getPayment(getReq, getRes as never);

    expect(getRes.statusCode).toBe(200);
    expect((getRes.payload as { id: string }).id).toBe(paymentId);
  });
});
