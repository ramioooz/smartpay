import { KafkaProducer, TOPICS, createKafkaClient, createLogger } from '@smartpay/shared';
import { config } from '../config';
import { refreshAllRates } from '../services/fx.service';

const logger = createLogger({ service: 'fx-srv', component: 'rate-publisher' });

let producer: KafkaProducer | null = null;
let timer: NodeJS.Timeout | null = null;

export async function startRatePublisher(): Promise<void> {
  if (producer || timer) {
    return;
  }

  const kafka = createKafkaClient('fx-srv-rate-publisher', config.kafkaBrokers);
  producer = new KafkaProducer(kafka.producer());
  await producer.connect();

  const publishCycle = async () => {
    try {
      const rates = await refreshAllRates();
      await Promise.all(
        rates.map((rate) =>
          producer?.publish(
            TOPICS.FX_RATE_UPDATED,
            {
              pair: rate.pair,
              bid: rate.bid,
              ask: rate.ask,
              mid: rate.mid,
              source: rate.source,
              timestamp: rate.timestamp.toISOString(),
            },
            {
              key: rate.pair,
            },
          ),
        ),
      );
    } catch (error) {
      logger.warn({ error }, 'FX rate publish cycle failed');
    }
  };

  await publishCycle();
  timer = setInterval(() => {
    void publishCycle();
  }, config.FX_RATE_REFRESH_INTERVAL_MS);
}

export async function stopRatePublisher(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
