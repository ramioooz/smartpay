import mongoose from 'mongoose';
import { logger } from '../logger';
import { retry } from '../utils/retry';

export interface MongoConnectionOptions {
  uri: string;
  maxPoolSize?: number;
}

export async function connectMongo(options: MongoConnectionOptions): Promise<typeof mongoose> {
  const { uri, maxPoolSize = 20 } = options;

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (error: Error) =>
    logger.error({ error }, 'MongoDB connection error'),
  );

  await retry(
    async () => {
      await mongoose.connect(uri, {
        maxPoolSize,
      });
    },
    {
      maxRetries: 5,
      baseDelayMs: 250,
    },
  );

  return mongoose;
}
