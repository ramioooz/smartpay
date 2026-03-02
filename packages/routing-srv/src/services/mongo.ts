import { MongoClient } from 'mongodb';
import { config } from '../config';

let mongoClient: MongoClient | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (!mongoClient) {
    mongoClient = new MongoClient(config.MONGO_URI);
    await mongoClient.connect();
  }

  return mongoClient;
}

export async function closeMongoClient(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
  }
}
