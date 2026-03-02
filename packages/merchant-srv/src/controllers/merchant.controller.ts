import { Request, Response } from 'express';
import { z } from 'zod';
import { apiKeyService } from '../services/api-key.service';
import { merchantService } from '../services/merchant.service';

const createMerchantSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

const updateMerchantSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
});

const upsertConfigSchema = z.object({
  enabledPSPs: z.array(z.string()).optional(),
  preferredCurrencies: z.array(z.string()).optional(),
  feeTier: z.enum(['standard', 'premium', 'enterprise']).optional(),
  fxSpreadBps: z.number().int().nonnegative().optional(),
  dailyLimit: z.number().positive().optional(),
  webhooks: z
    .object({
      'payment.settled': z.url().optional(),
      'payment.failed': z.url().optional(),
      'payment.refunded': z.url().optional(),
    })
    .optional(),
  routingPreferences: z
    .object({
      prioritize: z.enum(['cost', 'speed', 'reliability']).optional(),
      excludePSPs: z.array(z.string()).optional(),
    })
    .optional(),
});

const webhookSchema = z.object({
  event: z.enum(['payment.settled', 'payment.failed', 'payment.refunded']),
  url: z.url(),
});

export class MerchantController {
  private normalizeParam(param: string | string[] | undefined, name: string): string {
    const value = Array.isArray(param) ? param[0] : param;
    if (!value) {
      throw new Error(`Missing required path parameter: ${name}`);
    }

    return value;
  }

  async createMerchant(req: Request, res: Response): Promise<void> {
    const payload = createMerchantSchema.parse(req.body);
    const merchant = await merchantService.createMerchant(payload);
    res.status(201).json(merchant);
  }

  async getMerchant(req: Request, res: Response): Promise<void> {
    const merchantId = this.normalizeParam(req.params.id, 'id');
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: `Merchant ${merchantId} does not exist` });
      return;
    }

    res.status(200).json(merchant);
  }

  async updateMerchant(req: Request, res: Response): Promise<void> {
    const payload = updateMerchantSchema.parse(req.body);
    const merchantId = this.normalizeParam(req.params.id, 'id');
    const merchant = await merchantService.updateMerchant(merchantId, payload);
    res.status(200).json(merchant);
  }

  async generateApiKey(req: Request, res: Response): Promise<void> {
    const merchantId = this.normalizeParam(req.params.id, 'id');
    const pair = await apiKeyService.generateAndRotate(merchantId);
    res.status(201).json(pair);
  }

  async revokeApiKey(req: Request, res: Response): Promise<void> {
    const merchantId = this.normalizeParam(req.params.id, 'id');
    const keyId = this.normalizeParam(req.params.keyId, 'keyId');
    const revoked = await apiKeyService.revokeKey(merchantId, keyId);
    res.status(200).json({ id: revoked.id, status: revoked.status });
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    const payload = upsertConfigSchema.parse(req.body);
    const merchantId = this.normalizeParam(req.params.id, 'id');
    const config = await merchantService.upsertMerchantConfig(merchantId, payload);
    res.status(200).json(config);
  }

  async registerWebhook(req: Request, res: Response): Promise<void> {
    const payload = webhookSchema.parse(req.body);
    const merchantId = this.normalizeParam(req.params.id, 'id');
    const config = await merchantService.registerWebhook(merchantId, payload.event, payload.url);
    res.status(200).json(config);
  }

  async verifyApiKey(req: Request, res: Response): Promise<void> {
    const rawApiKey = req.header('X-API-Key');
    if (!rawApiKey) {
      res.status(401).json({ error: 'Missing X-API-Key header' });
      return;
    }

    const verification = await apiKeyService.verifyApiKey(rawApiKey);
    if (!verification.valid) {
      res.status(401).json({ valid: false, reason: verification.reason });
      return;
    }

    res.status(200).json({ valid: true, merchantId: verification.merchantId });
  }
}

export const merchantController = new MerchantController();
