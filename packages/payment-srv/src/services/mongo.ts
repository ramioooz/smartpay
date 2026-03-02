import { connectMongo } from '@smartpay/shared';
import mongoose from 'mongoose';
import { config } from '../config';

let mongoReady = false;

export async function connectMongoForPayment(): Promise<void> {
  if (mongoReady) {
    return;
  }

  await connectMongo({ uri: config.MONGO_URI, maxPoolSize: 20 });
  mongoReady = true;
}

export async function disconnectMongoForPayment(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
  mongoReady = false;
}
