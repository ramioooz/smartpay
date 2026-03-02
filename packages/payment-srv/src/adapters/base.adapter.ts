import {
  PSPAdapter,
  PSPHealthStatus,
  PSPPaymentRequest,
  PSPRefundResponse,
  PSPResponse,
  PSPTransactionStatus,
  RedisCircuitBreaker,
  retry,
} from '@smartpay/shared';
import type Redis from 'ioredis';

export abstract class BasePSPAdapter implements PSPAdapter {
  abstract readonly name: string;
  abstract readonly supportedCurrencies: string[];
  abstract readonly supportedCountries: string[];

  private readonly breaker: RedisCircuitBreaker;

  constructor(
    redis: Redis,
    adapterName: string,
  ) {
    this.breaker = new RedisCircuitBreaker(redis, {
      key: `circuit:${adapterName}`,
      failureThreshold: 5,
      cooldownSeconds: 30,
    });
  }

  protected abstract executeSubmitPayment(request: PSPPaymentRequest): Promise<PSPResponse>;
  protected abstract executeGetTransactionStatus(pspTransactionId: string): Promise<PSPTransactionStatus>;
  protected abstract executeInitiateRefund(
    pspTransactionId: string,
    amount: number,
  ): Promise<PSPRefundResponse>;
  protected abstract executeHealthCheck(): Promise<PSPHealthStatus>;

  async submitPayment(request: PSPPaymentRequest): Promise<PSPResponse> {
    const canExecute = await this.breaker.canExecute();
    if (!canExecute) {
      return {
        success: false,
        pspTransactionId: `${this.name}_unavailable`,
        status: 'REJECTED',
        message: `PSP ${this.name} circuit is OPEN`,
      };
    }

    try {
      const response = await retry(() => this.executeSubmitPayment(request), {
        maxRetries: 2,
        baseDelayMs: 100,
      });

      if (!response.success) {
        await this.breaker.recordFailure();
      } else {
        await this.breaker.recordSuccess();
      }

      return response;
    } catch (error) {
      await this.breaker.recordFailure();
      throw error;
    }
  }

  async getTransactionStatus(pspTransactionId: string): Promise<PSPTransactionStatus> {
    return this.executeGetTransactionStatus(pspTransactionId);
  }

  async initiateRefund(pspTransactionId: string, amount: number): Promise<PSPRefundResponse> {
    return this.executeInitiateRefund(pspTransactionId, amount);
  }

  async performHealthCheck(): Promise<PSPHealthStatus> {
    const canExecute = await this.breaker.canExecute();
    if (!canExecute) {
      return {
        healthy: false,
        latencyMs: 0,
        lastChecked: new Date(),
      };
    }

    return this.executeHealthCheck();
  }
}
