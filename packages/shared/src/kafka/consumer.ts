import {
  Consumer,
  ConsumerRunConfig,
  EachMessagePayload,
  KafkaMessage,
  Producer,
} from 'kafkajs';
import { logger } from '../logger';

export type MessageHandler<T> = (payload: T, message: KafkaMessage) => Promise<void>;

export interface ConsumerOptions {
  topic: string;
  dlqTopic?: string;
  maxFailures?: number;
}

export class KafkaConsumer {
  constructor(
    private readonly consumer: Consumer,
    private readonly producer: Producer,
  ) {}

  async connect(): Promise<void> {
    await this.consumer.connect();
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }

  async subscribeAndRun<T>(
    options: ConsumerOptions,
    handler: MessageHandler<T>,
    runConfig: Omit<ConsumerRunConfig, 'eachMessage'> = {},
  ): Promise<void> {
    const dlqTopic = options.dlqTopic ?? `${options.topic}.dlq`;
    const maxFailures = options.maxFailures ?? 3;

    await this.consumer.subscribe({ topic: options.topic, fromBeginning: false });

    await this.consumer.run({
      ...runConfig,
      eachMessage: async (messagePayload: EachMessagePayload) => {
        const { message, heartbeat } = messagePayload;
        let parsedPayload: T;
        try {
          parsedPayload = JSON.parse(message.value?.toString() ?? '{}') as T;
        } catch (error) {
          logger.error({ error, topic: options.topic }, 'Failed to deserialize Kafka payload');
          return;
        }

        for (let attempt = 1; attempt <= maxFailures; attempt += 1) {
          try {
            await handler(parsedPayload, message);
            await heartbeat();
            return;
          } catch (error) {
            logger.warn(
              {
                error,
                topic: options.topic,
                attempt,
                maxFailures,
              },
              'Kafka handler failed',
            );

            if (attempt === maxFailures) {
              await this.producer.send({
                topic: dlqTopic,
                messages: [
                  {
                    key: message.key?.toString(),
                    value: message.value,
                    headers: {
                      ...(message.headers ?? {}),
                      'x-error': Buffer.from(String(error instanceof Error ? error.message : error)),
                    },
                  },
                ],
              });
            }
          }
        }
      },
    });
  }

  registerGracefulShutdown(): void {
    const shutdown = async () => {
      logger.info('Shutting down Kafka consumer');
      await this.disconnect();
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}
