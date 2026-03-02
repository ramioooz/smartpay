import { randomUUID } from 'node:crypto';

export async function simulateLatency(minMs: number, maxMs: number): Promise<number> {
  const latency = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, latency));
  return latency;
}

export function randomSuccess(successRate: number): boolean {
  return Math.random() <= successRate;
}

export function buildTransactionId(prefix: string): string {
  return `${prefix}_tx_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
