import { PSPHealthStatus, PSPPaymentRequest, PSPRefundResponse, PSPResponse, PSPTransactionStatus } from '@smartpay/shared';
import type Redis from 'ioredis';
import { BasePSPAdapter } from './base.adapter';
import { buildTransactionId, randomSuccess, simulateLatency } from './simulated';

export class StripeAdapter extends BasePSPAdapter {
  readonly name = 'stripe';
  readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  readonly supportedCountries = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL'];

  constructor(redis: Redis) {
    super(redis, 'stripe');
  }

  protected async executeSubmitPayment(request: PSPPaymentRequest): Promise<PSPResponse> {
    await simulateLatency(50, 200);

    if (!randomSuccess(0.95)) {
      return {
        success: false,
        pspTransactionId: buildTransactionId(this.name),
        status: 'REJECTED',
        message: `PSP ${this.name} rejected payment ${request.paymentId}`,
      };
    }

    return {
      success: true,
      pspTransactionId: buildTransactionId(this.name),
      status: 'ACCEPTED',
      estimatedSettlement: new Date(Date.now() + 60_000),
    };
  }

  protected async executeGetTransactionStatus(pspTransactionId: string): Promise<PSPTransactionStatus> {
    await simulateLatency(20, 90);

    return {
      pspTransactionId,
      status: 'SETTLED',
      updatedAt: new Date(),
    };
  }

  protected async executeInitiateRefund(
    pspTransactionId: string,
    amount: number,
  ): Promise<PSPRefundResponse> {
    void amount;
    await simulateLatency(50, 150);

    return {
      success: true,
      refundId: `stripe_ref_${pspTransactionId}`,
      status: 'INITIATED',
    };
  }

  protected async executeHealthCheck(): Promise<PSPHealthStatus> {
    const latency = await simulateLatency(20, 60);

    return {
      healthy: randomSuccess(0.98),
      latencyMs: latency,
      lastChecked: new Date(),
      successRate: 0.95,
    };
  }
}
