import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from './prisma';

export interface GeneratedApiKeyPair {
  keyId: string;
  publicKey: string;
  secretKey: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'REVOKED';
}

export interface VerifyApiKeyResult {
  valid: boolean;
  merchantId?: string;
  reason?: string;
}

export class ApiKeyService {
  async generateAndRotate(merchantId: string): Promise<GeneratedApiKeyPair> {
    const publicKey = `pk_live_${nanoid(24)}`;
    const secretKey = `sk_live_${nanoid(36)}`;
    const secretKeyHash = await bcrypt.hash(secretKey, 10);
    const rotationCutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.apiKey.updateMany({
        where: {
          merchantId,
          status: 'ACTIVE',
        },
        data: {
          status: 'DEPRECATED',
          expiresAt: rotationCutoff,
        },
      });

      return tx.apiKey.create({
        data: {
          merchantId,
          publicKey,
          secretKeyHash,
          status: 'ACTIVE',
        },
      });
    });

    return {
      keyId: created.id,
      publicKey,
      secretKey,
      status: created.status,
    };
  }

  async revokeKey(merchantId: string, keyId: string) {
    const result = await prisma.apiKey.updateMany({
      where: { id: keyId, merchantId },
      data: {
        status: 'REVOKED',
        expiresAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new Error(`API key ${keyId} does not exist for merchant ${merchantId}`);
    }

    return { id: keyId, status: 'REVOKED' as const };
  }

  async verifyApiKey(rawApiKey: string): Promise<VerifyApiKeyResult> {
    const [publicKey, secretKey] = rawApiKey.split(':');

    if (!publicKey || !secretKey) {
      return {
        valid: false,
        reason: 'Malformed API key, expected format pk_live_xxx:sk_live_xxx',
      };
    }

    const keyRecord = await prisma.apiKey.findUnique({
      where: { publicKey },
      include: { merchant: true },
    });

    if (!keyRecord) {
      return { valid: false, reason: `API public key ${publicKey} was not found` };
    }

    if (keyRecord.status === 'REVOKED') {
      return { valid: false, reason: `API key ${publicKey} has been revoked` };
    }

    if (keyRecord.status === 'DEPRECATED' && keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return { valid: false, reason: `API key ${publicKey} is deprecated and expired` };
    }

    if (keyRecord.merchant.status !== 'ACTIVE') {
      return {
        valid: false,
        reason: `Merchant ${keyRecord.merchant.id} is ${keyRecord.merchant.status} and cannot authenticate`,
      };
    }

    const isMatch = await bcrypt.compare(secretKey, keyRecord.secretKeyHash);
    if (!isMatch) {
      return { valid: false, reason: `Secret key does not match public key ${publicKey}` };
    }

    return {
      valid: true,
      merchantId: keyRecord.merchantId,
    };
  }
}

export const apiKeyService = new ApiKeyService();
