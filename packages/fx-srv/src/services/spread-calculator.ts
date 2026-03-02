export type SpreadResult = {
  spreadBps: number;
  spreadRate: number;
  appliedRate: number;
  targetAmount: number;
};

export function calculateSpread(midRate: number, sourceAmount: number, merchantSpreadBps = 50): SpreadResult {
  const tierSpreadBps = sourceAmount > 1_000_000 ? 15 : sourceAmount > 100_000 ? 30 : merchantSpreadBps;
  const spreadRate = tierSpreadBps / 10_000;
  const appliedRate = midRate * (1 + spreadRate);
  const targetAmount = Number((sourceAmount * appliedRate).toFixed(8));

  return {
    spreadBps: tierSpreadBps,
    spreadRate,
    appliedRate,
    targetAmount,
  };
}
