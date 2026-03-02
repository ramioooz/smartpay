import { PSPHealthStatus, PSPPaymentRequest, PSPRefundResponse, PSPResponse, PSPTransactionStatus } from '@smartpay/shared';
import type Redis from 'ioredis';
import { BasePSPAdapter } from './base.adapter';
import { buildTransactionId, randomSuccess, simulateLatency } from './simulated';

export class CryptoRailAdapter extends BasePSPAdapter {
  readonly name = 'crypto-rail';
  readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'PHP', 'BRL', 'SAR', 'KWD'];
  readonly supportedCountries = ['US', 'GB', 'AE', 'IN', 'PH', 'BR', 'SA', 'KW', 'DE', 'FR', 'NL'];

  constructor(redis: Redis) {
    super(redis, 'crypto-rail');
  }

  protected async executeSubmitPayment(request: PSPPaymentRequest): Promise<PSPResponse> {
    await simulateLatency(200, 600);

    if (!randomSuccess(0.88)) {
      return {
        success: false,
        pspTransactionId: buildTransactionId(this.name),
        status: 'REJECTED',
        message: `PSP ${this.name} timed out for payment ${request.paymentId}`,
      };
    }

    return {
      success: true,
      pspTransactionId: buildTransactionId(this.name),
      status: randomSuccess(0.15) ? 'PENDING' : 'ACCEPTED',
      estimatedSettlement: new Date(Date.now() + 180_000),
    };
  }

  protected async executeGetTransactionStatus(pspTransactionId: string): Promise<PSPTransactionStatus> {
    await simulateLatency(70, 240);

    return {
      pspTransactionId,
      status: randomSuccess(0.9) ? 'SETTLED' : 'PROCESSING',
      updatedAt: new Date(),
    };
  }

  protected async executeInitiateRefund(
    pspTransactionId: string,
    amount: number,
  ): Promise<PSPRefundResponse> {
    void amount;
    await simulateLatency(180, 400);

    return {
      success: randomSuccess(0.92),
      refundId: `crypto_ref_${pspTransactionId}`,
      status: 'INITIATED',
    };
  }

  protected async executeHealthCheck(): Promise<PSPHealthStatus> {
    const latency = await simulateLatency(100, 220);

    return {
      healthy: randomSuccess(0.93),
      latencyMs: latency,
      lastChecked: new Date(),
      successRate: 0.88,
    };
  }
}
