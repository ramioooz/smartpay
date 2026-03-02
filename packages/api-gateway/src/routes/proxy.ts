import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import { httpClient } from '../services/http';

function normalizePath(path: string): string {
  if (path.startsWith('/')) {
    return path;
  }

  return `/${path}`;
}

function buildUpstreamUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  return `${trimmedBase}${normalizePath(path)}`;
}

export async function proxyRequest(req: Request, res: Response, baseUrl: string, path: string): Promise<void> {
  const upstreamUrl = buildUpstreamUrl(baseUrl, path);

  try {
    const response = await httpClient.request({
      method: req.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
      url: upstreamUrl,
      data: req.body,
      params: req.query,
      headers: {
        'content-type': req.header('content-type') ?? 'application/json',
        'x-request-id': req.header('X-Request-ID') ?? '',
        'x-api-key': req.header('X-API-Key') ?? '',
      },
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      res.status(axiosError.response.status).json(axiosError.response.data);
      return;
    }

    res.status(502).json({
      error: `Upstream service is unreachable at ${upstreamUrl}`,
    });
  }
}
