import Redis from 'ioredis';

export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  keyPrefix?: string;
}

export function createRedisClient(options: RedisConnectionOptions): Redis {
  const { host, port, password, keyPrefix } = options;

  return new Redis({
    host,
    port,
    password,
    keyPrefix,
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(200 * 2 ** times, 5_000),
  });
}
