import { RedisCircuitBreaker } from '../../packages/shared/src/utils/circuit-breaker';
import { IdempotencyStore } from '../../packages/shared/src/utils/idempotency';
import { retry } from '../../packages/shared/src/utils/retry';

type RedisLike = {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  incr: jest.Mock;
  exists: jest.Mock;
};

function createRedisMock(): RedisLike {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    exists: jest.fn(),
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
      redis.exists.mockResolvedValue(1);
      redis.set.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);

      const breaker = new RedisCircuitBreaker(redis as never, {
        key: 'payment:circuit:stripe',
        failureThreshold: 3,
        cooldownSeconds: 60,
      });

      await breaker.recordFailure();
      const canExecute = await breaker.canExecute();

      expect(redis.set).toHaveBeenCalledWith('payment:circuit:stripe:state', 'OPEN');
      expect(redis.set).toHaveBeenCalledWith(
        'payment:circuit:stripe:cooldown',
        '1',
        'EX',
        60,
      );
      expect(redis.del).toHaveBeenCalledWith('payment:circuit:stripe:trial');
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
      expect(redis.del).toHaveBeenCalledWith(
        'payment:circuit:wise:failures',
        'payment:circuit:wise:cooldown',
        'payment:circuit:wise:trial',
      );
    });

    it('moves to HALF_OPEN after cooldown and allows only one trial', async () => {
      const redis = createRedisMock();
      redis.get.mockResolvedValue('OPEN');
      redis.exists.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK');

      const breaker = new RedisCircuitBreaker(redis as never, {
        key: 'payment:circuit:checkout',
        failureThreshold: 2,
        cooldownSeconds: 30,
      });

      const firstAttempt = await breaker.canExecute();
      const secondAttempt = await breaker.canExecute();

      expect(firstAttempt).toBe(true);
      expect(secondAttempt).toBe(false);
      expect(redis.set).toHaveBeenCalledWith(
        'payment:circuit:checkout:trial',
        '1',
        'EX',
        30,
        'NX',
      );
      expect(redis.set).toHaveBeenCalledWith('payment:circuit:checkout:state', 'HALF_OPEN');
    });

    it('re-opens immediately when trial request fails in HALF_OPEN', async () => {
      const redis = createRedisMock();
      redis.get.mockResolvedValue('HALF_OPEN');
      redis.set.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);

      const breaker = new RedisCircuitBreaker(redis as never, {
        key: 'payment:circuit:crypto-rail',
        failureThreshold: 2,
        cooldownSeconds: 25,
      });

      await breaker.recordFailure();

      expect(redis.set).toHaveBeenCalledWith('payment:circuit:crypto-rail:state', 'OPEN');
      expect(redis.set).toHaveBeenCalledWith(
        'payment:circuit:crypto-rail:cooldown',
        '1',
        'EX',
        25,
      );
      expect(redis.del).toHaveBeenCalledWith('payment:circuit:crypto-rail:trial');
    });
  });
});
