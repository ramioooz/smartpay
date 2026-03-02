import { PSPHealthStatus, PSPPaymentRequest, PSPRefundResponse, PSPResponse, PSPTransactionStatus } from '@smartpay/shared';
import type Redis from 'ioredis';
import { BasePSPAdapter } from './base.adapter';
import { buildTransactionId, randomSuccess, simulateLatency } from './simulated';

export class CheckoutAdapter extends BasePSPAdapter {
  readonly name = 'checkout';
  readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD'];
  readonly supportedCountries = ['AE', 'SA', 'KW', 'GB', 'US', 'FR'];

  constructor(redis: Redis) {
    super(redis, 'checkout');
  }

  protected async executeSubmitPayment(request: PSPPaymentRequest): Promise<PSPResponse> {
    await simulateLatency(80, 250);

    if (!randomSuccess(0.9)) {
      return {
        success: false,
        pspTransactionId: buildTransactionId(this.name),
        status: 'REJECTED',
        message: `PSP ${this.name} is not responding, tried 2 retries for ${request.paymentId}`,
      };
    }

    return {
      success: true,
      pspTransactionId: buildTransactionId(this.name),
      status: randomSuccess(0.08) ? 'PENDING' : 'ACCEPTED',
      estimatedSettlement: new Date(Date.now() + 90_000),
    };
  }

  protected async executeGetTransactionStatus(pspTransactionId: string): Promise<PSPTransactionStatus> {
    await simulateLatency(20, 100);

    return {
      pspTransactionId,
      status: randomSuccess(0.93) ? 'SETTLED' : 'FAILED',
      updatedAt: new Date(),
    };
  }

  protected async executeInitiateRefund(
    pspTransactionId: string,
    amount: number,
  ): Promise<PSPRefundResponse> {
    void amount;
    await simulateLatency(60, 180);

    return {
      success: randomSuccess(0.96),
      refundId: `checkout_ref_${pspTransactionId}`,
      status: 'INITIATED',
    };
  }

  protected async executeHealthCheck(): Promise<PSPHealthStatus> {
    const latency = await simulateLatency(30, 95);

    return {
      healthy: randomSuccess(0.95),
      latencyMs: latency,
      lastChecked: new Date(),
      successRate: 0.9,
    };
  }
}
