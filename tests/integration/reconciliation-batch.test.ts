const runManualMock = jest.fn();

jest.mock('../../packages/reconciliation-srv/src/services/reconciliation.service', () => ({
  reconciliationService: {
    runManual: runManualMock,
    listReports: jest.fn(),
    getReportById: jest.fn(),
    listDiscrepancies: jest.fn(),
    resolveDiscrepancy: jest.fn(),
  },
}));

import { reconciliationController } from '../../packages/reconciliation-srv/src/controllers/reconciliation.controller';

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

describe('integration/reconciliation-batch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs reconciliation and returns discrepancy classification summary', async () => {
    runManualMock.mockResolvedValue({
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-01T01:00:00.000Z',
      reports: [
        {
          reportId: 'report-1',
          pspName: 'stripe',
          totalInternal: 10,
          totalPSP: 10,
          matched: 9,
          discrepancyCount: 1,
          autoResolved: 0,
          needsReview: 1,
        },
      ],
    });

    const req = {
      body: {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-01T01:00:00.000Z',
        pspName: 'stripe',
      },
    } as never;
    const res = responseMock();
    await reconciliationController.runReconciliation(req, res as never);

    expect(res.statusCode).toBe(200);
    expect(((res.payload as { reports: unknown[] }).reports ?? []).length).toBe(1);
    expect(runManualMock).toHaveBeenCalledWith(expect.objectContaining({ pspName: 'stripe' }));
  });
});
