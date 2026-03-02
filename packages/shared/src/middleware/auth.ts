import { Request, Response, NextFunction, RequestHandler } from 'express';

export interface AuthOptions {
  headerName?: string;
  developmentTestKey?: string;
}

export function apiKeyAuth(options: AuthOptions = {}): RequestHandler {
  const headerName = options.headerName ?? 'X-API-Key';

  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.header(headerName);
    if (!apiKey) {
      res.status(401).json({ error: `Missing API key in ${headerName}` });
      return;
    }

    if (process.env.NODE_ENV !== 'production' && options.developmentTestKey && apiKey === options.developmentTestKey) {
      next();
      return;
    }

    next();
  };
}
