import { Collection } from 'mongodb';
import { DEFAULT_MERCHANT_CONFIG, MerchantConfigDocument } from '../models/merchant-config.model';
import { prisma } from './prisma';
import { getMongoClient } from './mongo';

export type MerchantConfigPatch = Partial<
  Omit<MerchantConfigDocument, 'merchantId' | 'updatedAt' | 'routingPreferences' | 'webhooks'>
> & {
  routingPreferences?: Partial<MerchantConfigDocument['routingPreferences']>;
  webhooks?: Partial<MerchantConfigDocument['webhooks']>;
};

export class MerchantService {
  private async configCollection(): Promise<Collection<MerchantConfigDocument>> {
    const mongo = await getMongoClient();
    return mongo.db('smartpay').collection<MerchantConfigDocument>('merchant_configs');
  }

  async createMerchant(input: { name: string; email: string }) {
    const merchant = await prisma.merchant.create({
      data: {
        name: input.name,
        email: input.email,
      },
    });

    const collection = await this.configCollection();
    await collection.updateOne(
      { merchantId: merchant.id },
      {
        $setOnInsert: {
          merchantId: merchant.id,
          ...DEFAULT_MERCHANT_CONFIG,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return merchant;
  }

  async getMerchantById(id: string) {
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        apiKeys: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!merchant) {
      return null;
    }

    const collection = await this.configCollection();
    const config = await collection.findOne({ merchantId: id });

    return {
      ...merchant,
      config,
    };
  }

  async updateMerchant(
    id: string,
    input: Partial<{ name: string; email: string; status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' }>,
  ) {
    return prisma.merchant.update({
      where: { id },
      data: input,
    });
  }

  async upsertMerchantConfig(merchantId: string, patch: MerchantConfigPatch) {
    const collection = await this.configCollection();
    const updateSet: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (patch.enabledPSPs !== undefined) updateSet.enabledPSPs = patch.enabledPSPs;
    if (patch.preferredCurrencies !== undefined) {
      updateSet.preferredCurrencies = patch.preferredCurrencies;
    }
    if (patch.feeTier !== undefined) updateSet.feeTier = patch.feeTier;
    if (patch.fxSpreadBps !== undefined) updateSet.fxSpreadBps = patch.fxSpreadBps;
    if (patch.dailyLimit !== undefined) updateSet.dailyLimit = patch.dailyLimit;
    if (patch.routingPreferences?.prioritize !== undefined) {
      updateSet['routingPreferences.prioritize'] = patch.routingPreferences.prioritize;
    }
    if (patch.routingPreferences?.excludePSPs !== undefined) {
      updateSet['routingPreferences.excludePSPs'] = patch.routingPreferences.excludePSPs;
    }
    if (patch.webhooks !== undefined) updateSet.webhooks = patch.webhooks;

    await collection.updateOne(
      { merchantId },
      {
        $set: updateSet,
        $setOnInsert: {
          merchantId,
          ...DEFAULT_MERCHANT_CONFIG,
        },
      },
      { upsert: true },
    );

    return collection.findOne({ merchantId });
  }

  async registerWebhook(merchantId: string, event: keyof MerchantConfigDocument['webhooks'], url: string) {
    const collection = await this.configCollection();
    const result = await collection.findOneAndUpdate(
      { merchantId },
      {
        $set: {
          [`webhooks.${event}`]: url,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          merchantId,
          ...DEFAULT_MERCHANT_CONFIG,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return result;
  }
}

export const merchantService = new MerchantService();
