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

  async getState(): Promise<CircuitState> {
    const state = await this.redis.get(this.stateKey());
    if (state === 'OPEN' || state === 'HALF_OPEN' || state === 'CLOSED') {
      return state;
    }

    return 'CLOSED';
  }

  async canExecute(): Promise<boolean> {
    return (await this.getState()) !== 'OPEN';
  }

  async recordSuccess(): Promise<void> {
    await this.redis.set(this.stateKey(), 'CLOSED');
    await this.redis.del(this.failuresKey());
  }

  async recordFailure(): Promise<void> {
    const failures = await this.redis.incr(this.failuresKey());
    if (failures >= this.options.failureThreshold) {
      await this.redis.set(this.stateKey(), 'OPEN', 'EX', this.options.cooldownSeconds);
      // TODO: transition to HALF_OPEN after cooldown for one-shot trial calls.
    }
  }
}
