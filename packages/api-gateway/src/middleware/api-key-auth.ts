import { NextFunction, Request, Response } from 'express';
import { httpClient } from '../services/http';
import { config } from '../config';

type GatewayRequest = Request & {
  merchantId?: string;
  apiKey?: string;
};

export async function apiKeyAuth(req: GatewayRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.header('X-API-Key');
  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  try {
    const response = await httpClient.get(`${config.MERCHANT_SRV_URL}/merchants/verify-key`, {
      headers: {
        'X-API-Key': apiKey,
        'X-Request-ID': req.header('X-Request-ID') ?? '',
      },
    });

    if (!response.data?.valid) {
      res.status(401).json({ error: response.data?.reason ?? 'API key verification failed' });
      return;
    }

    req.apiKey = apiKey;
    req.merchantId = response.data.merchantId;
    next();
  } catch {
    res.status(401).json({ error: 'Unable to verify API key with merchant service' });
  }
}
