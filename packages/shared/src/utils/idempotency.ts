import type Redis from 'ioredis';

export interface IdempotencyResult {
  created: boolean;
  value?: string;
}

export class IdempotencyStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = 24 * 60 * 60,
  ) {}

  async acquireLock(key: string, owner: string, ttlSeconds = 30): Promise<boolean> {
    const result = await this.redis.set(this.lockKey(key), owner, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(this.lockKey(key));
  }

  async getOrCreate(key: string, value: string): Promise<IdempotencyResult> {
    const existing = await this.redis.get(this.valueKey(key));
    if (existing) {
      return { created: false, value: existing };
    }

    await this.redis.set(this.valueKey(key), value, 'EX', this.ttlSeconds);
    return { created: true, value };
  }

  private valueKey(key: string): string {
    return `idempotency:value:${key}`;
  }

  private lockKey(key: string): string {
    return `idempotency:lock:${key}`;
  }
}
