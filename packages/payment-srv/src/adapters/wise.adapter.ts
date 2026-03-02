import { PSPHealthStatus, PSPPaymentRequest, PSPRefundResponse, PSPResponse, PSPTransactionStatus } from '@smartpay/shared';
import type Redis from 'ioredis';
import { BasePSPAdapter } from './base.adapter';
import { buildTransactionId, randomSuccess, simulateLatency } from './simulated';

export class WiseAdapter extends BasePSPAdapter {
  readonly name = 'wise';
  readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'PHP', 'BRL'];
  readonly supportedCountries = ['US', 'GB', 'AE', 'IN', 'PH', 'BR', 'CA', 'DE', 'FR'];

  constructor(redis: Redis) {
    super(redis, 'wise');
  }

  protected async executeSubmitPayment(request: PSPPaymentRequest): Promise<PSPResponse> {
    await simulateLatency(100, 400);

    if (!randomSuccess(0.92)) {
      return {
        success: false,
        pspTransactionId: buildTransactionId(this.name),
        status: 'REJECTED',
        message: `PSP ${this.name} could not submit payment ${request.paymentId}`,
      };
    }

    return {
      success: true,
      pspTransactionId: buildTransactionId(this.name),
      status: 'ACCEPTED',
      estimatedSettlement: new Date(Date.now() + 120_000),
    };
  }

  protected async executeGetTransactionStatus(pspTransactionId: string): Promise<PSPTransactionStatus> {
    await simulateLatency(30, 140);

    return {
      pspTransactionId,
      status: randomSuccess(0.95) ? 'SETTLED' : 'PROCESSING',
      updatedAt: new Date(),
    };
  }

  protected async executeInitiateRefund(
    pspTransactionId: string,
    amount: number,
  ): Promise<PSPRefundResponse> {
    void amount;
    await simulateLatency(80, 220);

    return {
      success: true,
      refundId: `wise_ref_${pspTransactionId}`,
      status: 'INITIATED',
    };
  }

  protected async executeHealthCheck(): Promise<PSPHealthStatus> {
    const latency = await simulateLatency(40, 120);

    return {
      healthy: randomSuccess(0.96),
      latencyMs: latency,
      lastChecked: new Date(),
      successRate: 0.92,
    };
  }
}
