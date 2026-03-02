import { Kafka, KafkaConfig } from 'kafkajs';

export function createKafkaClient(clientId: string, brokers: string[]) {
  const config: KafkaConfig = {
    clientId,
    brokers,
  };

  return new Kafka(config);
}
