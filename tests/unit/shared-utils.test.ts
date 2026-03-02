import { RedisCircuitBreaker } from '../../packages/shared/src/utils/circuit-breaker';
import { IdempotencyStore } from '../../packages/shared/src/utils/idempotency';
import { retry } from '../../packages/shared/src/utils/retry';

type RedisLike = {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  incr: jest.Mock;
};

function createRedisMock(): RedisLike {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
  };
}

describe('shared utils', () => {
  describe('retry', () => {
    it('retries failures and eventually returns success', async () => {
      const fn = jest
        .fn<Promise<string>, []>()
        .mockRejectedValueOnce(new Error('transient-1'))
        .mockRejectedValueOnce(new Error('transient-2'))
        .mockResolvedValue('ok');

      const result = await retry(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        jitter: false,
      });

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('stops when shouldRetry returns false', async () => {
      const fn = jest.fn<Promise<string>, []>().mockRejectedValue(new Error('fatal'));

      await expect(
        retry(fn, {
          maxRetries: 3,
          baseDelayMs: 1,
          jitter: false,
          shouldRetry: () => false,
        }),
      ).rejects.toThrow('fatal');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('idempotency store', () => {
    it('acquires lock with atomic NX set and releases lock key', async () => {
      const redis = createRedisMock();
      redis.set.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);

      const store = new IdempotencyStore(redis as never);
      const acquired = await store.acquireLock('merchant:ext-ref', 'owner-1', 30);
      await store.releaseLock('merchant:ext-ref');

      expect(acquired).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        'idempotency:lock:merchant:ext-ref',
        'owner-1',
        'EX',
        30,
        'NX',
      );
      expect(redis.del).toHaveBeenCalledWith('idempotency:lock:merchant:ext-ref');
    });

    it('returns existing value without overwriting on duplicate key', async () => {
      const redis = createRedisMock();
      redis.get.mockResolvedValue('cached-response');

      const store = new IdempotencyStore(redis as never);
      const result = await store.getOrCreate('merchant:ext-ref', 'new-response');

      expect(result).toEqual({ created: false, value: 'cached-response' });
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('redis circuit breaker', () => {
    it('opens circuit after threshold failures and blocks execution', async () => {
      const redis = createRedisMock();
      redis.incr.mockResolvedValue(3);
      redis.get.mockResolvedValue('OPEN');

      const breaker = new RedisCircuitBreaker(redis as never, {
        key: 'payment:circuit:stripe',
        failureThreshold: 3,
        cooldownSeconds: 60,
      });

      await breaker.recordFailure();
      const canExecute = await breaker.canExecute();

      expect(redis.set).toHaveBeenCalledWith(
        'payment:circuit:stripe:state',
        'OPEN',
        'EX',
        60,
      );
      expect(canExecute).toBe(false);
    });

    it('closes circuit and clears failures after success', async () => {
      const redis = createRedisMock();
      redis.set.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);

      const breaker = new RedisCircuitBreaker(redis as never, {
        key: 'payment:circuit:wise',
        failureThreshold: 2,
        cooldownSeconds: 45,
      });

      await breaker.recordSuccess();

      expect(redis.set).toHaveBeenCalledWith('payment:circuit:wise:state', 'CLOSED');
      expect(redis.del).toHaveBeenCalledWith('payment:circuit:wise:failures');
    });
  });
});
