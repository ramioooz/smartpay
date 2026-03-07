import type Redis from 'ioredis';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  key: string;
  failureThreshold: number;
  cooldownSeconds: number;
}

export class RedisCircuitBreaker {
  constructor(
    private readonly redis: Redis,
    private readonly options: CircuitBreakerOptions,
  ) {}

  private failuresKey(): string {
    return `${this.options.key}:failures`;
  }

  private stateKey(): string {
    return `${this.options.key}:state`;
  }

  private cooldownKey(): string {
    return `${this.options.key}:cooldown`;
  }

  private trialKey(): string {
    return `${this.options.key}:trial`;
  }

  private async tripOpen(): Promise<void> {
    await this.redis.set(this.stateKey(), 'OPEN');
    await this.redis.set(this.cooldownKey(), '1', 'EX', this.options.cooldownSeconds);
    await this.redis.del(this.trialKey());
  }

  private async tryAcquireHalfOpenTrial(): Promise<boolean> {
    const trialAcquired = await this.redis.set(
      this.trialKey(),
      '1',
      'EX',
      this.options.cooldownSeconds,
      'NX',
    );

    if (trialAcquired !== 'OK') {
      return false;
    }

    await this.redis.set(this.stateKey(), 'HALF_OPEN');
    return true;
  }

  async getState(): Promise<CircuitState> {
    const state = await this.redis.get(this.stateKey());
    if (state === 'OPEN' || state === 'HALF_OPEN' || state === 'CLOSED') {
      return state;
    }

    return 'CLOSED';
  }

  async canExecute(): Promise<boolean> {
    const state = await this.getState();
    if (state === 'CLOSED') {
      return true;
    }

    if (state === 'OPEN') {
      const cooldownExists = (await this.redis.exists(this.cooldownKey())) > 0;
      if (cooldownExists) {
        return false;
      }

      return this.tryAcquireHalfOpenTrial();
    }

    const trialExists = (await this.redis.exists(this.trialKey())) > 0;
    if (trialExists) {
      return false;
    }

    return this.tryAcquireHalfOpenTrial();
  }

  async recordSuccess(): Promise<void> {
    await this.redis.set(this.stateKey(), 'CLOSED');
    await this.redis.del(this.failuresKey(), this.cooldownKey(), this.trialKey());
  }

  async recordFailure(): Promise<void> {
    const state = await this.getState();
    if (state === 'HALF_OPEN') {
      await this.tripOpen();
      return;
    }

    const failures = await this.redis.incr(this.failuresKey());
    if (failures >= this.options.failureThreshold) {
      await this.tripOpen();
    }
  }
}
