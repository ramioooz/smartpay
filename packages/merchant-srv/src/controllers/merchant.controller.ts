import { Request, Response } from 'express';
import { apiKeyService } from '../services/api-key.service';
import { merchantService } from '../services/merchant.service';
import {
  apiKeyHeaderSchema,
  createMerchantSchema,
  merchantIdParamsSchema,
  merchantKeyParamsSchema,
  updateMerchantSchema,
  upsertConfigSchema,
  webhookSchema,
} from '../validators/merchant.validators';

export class MerchantController {
  async createMerchant(req: Request, res: Response): Promise<void> {
    const payload = createMerchantSchema.parse(req.body);
    const merchant = await merchantService.createMerchant(payload);
    res.status(201).json(merchant);
  }

  async getMerchant(req: Request, res: Response): Promise<void> {
    const { id: merchantId } = merchantIdParamsSchema.parse(req.params);
    const merchant = await merchantService.getMerchantById(merchantId);
    if (!merchant) {
      res.status(404).json({ error: `Merchant ${merchantId} does not exist` });
      return;
    }

    res.status(200).json(merchant);
  }

  async updateMerchant(req: Request, res: Response): Promise<void> {
    const payload = updateMerchantSchema.parse(req.body);
    const { id: merchantId } = merchantIdParamsSchema.parse(req.params);
    const merchant = await merchantService.updateMerchant(merchantId, payload);
    res.status(200).json(merchant);
  }

  async generateApiKey(req: Request, res: Response): Promise<void> {
    const { id: merchantId } = merchantIdParamsSchema.parse(req.params);
    const pair = await apiKeyService.generateAndRotate(merchantId);
    res.status(201).json(pair);
  }

  async revokeApiKey(req: Request, res: Response): Promise<void> {
    const { id: merchantId, keyId } = merchantKeyParamsSchema.parse(req.params);
    const revoked = await apiKeyService.revokeKey(merchantId, keyId);
    res.status(200).json({ id: revoked.id, status: revoked.status });
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    const payload = upsertConfigSchema.parse(req.body);
    const { id: merchantId } = merchantIdParamsSchema.parse(req.params);
    const config = await merchantService.upsertMerchantConfig(merchantId, payload);
    res.status(200).json(config);
  }

  async registerWebhook(req: Request, res: Response): Promise<void> {
    const payload = webhookSchema.parse(req.body);
    const { id: merchantId } = merchantIdParamsSchema.parse(req.params);
    const config = await merchantService.registerWebhook(merchantId, payload.event, payload.url);
    res.status(200).json(config);
  }

  async verifyApiKey(req: Request, res: Response): Promise<void> {
    const parsedApiKey = apiKeyHeaderSchema.safeParse(req.header('X-API-Key'));
    if (!parsedApiKey.success) {
      res.status(401).json({ error: 'Missing X-API-Key header' });
      return;
    }

    const verification = await apiKeyService.verifyApiKey(parsedApiKey.data);
    if (!verification.valid) {
      res.status(401).json({ valid: false, reason: verification.reason });
      return;
    }

    res.status(200).json({ valid: true, merchantId: verification.merchantId });
  }
}

export const merchantController = new MerchantController();
