import {
  createKafkaClient,
  KafkaConsumer,
  KafkaProducer,
} from '@smartpay/shared';
import { config } from '../config';

let producer: KafkaProducer | null = null;
let consumer: KafkaConsumer | null = null;

export async function getKafkaProducer(): Promise<KafkaProducer> {
  if (!producer) {
    const kafka = createKafkaClient('reconciliation-srv-producer', config.kafkaBrokers);
    producer = new KafkaProducer(kafka.producer());
    await producer.connect();
  }

  return producer;
}

export async function getKafkaConsumer(groupId: string): Promise<KafkaConsumer> {
  if (!consumer) {
    const kafka = createKafkaClient('reconciliation-srv-consumer', config.kafkaBrokers);
    consumer = new KafkaConsumer(kafka.consumer({ groupId }), kafka.producer());
    await consumer.connect();
  }

  return consumer;
}

export async function closeKafkaConnections(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }

  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
