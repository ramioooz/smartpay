import pino, { LoggerOptions } from 'pino';

const defaultOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: process.env.SERVICE_NAME ?? 'shared',
  },
  redact: {
    paths: ['req.headers.authorization', 'headers.authorization', '*.secret', '*.token'],
    censor: '[REDACTED]',
  },
};

export const logger = pino(defaultOptions);

export function createLogger(bindings?: Record<string, string | number | boolean>) {
  return logger.child(bindings ?? {});
}
