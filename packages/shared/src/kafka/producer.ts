import { Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import { logger } from '../logger';
import { retry } from '../utils/retry';

export interface PublishOptions {
  key?: string;
  correlationId?: string;
  headers?: Record<string, string>;
}

export class KafkaProducer {
  constructor(private readonly producer: Producer) {}

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish<T>(topic: string, payload: T, options: PublishOptions = {}): Promise<void> {
    const correlationId = options.correlationId ?? randomUUID();

    await retry(
      async () => {
        await this.producer.send({
          topic,
          messages: [
            {
              key: options.key,
              value: JSON.stringify(payload),
              headers: {
                ...options.headers,
                'x-correlation-id': correlationId,
              },
            },
          ],
        });
      },
      {
        maxRetries: 3,
        baseDelayMs: 100,
      },
    );

    logger.debug({ topic, correlationId }, 'Kafka message published');
  }
}
