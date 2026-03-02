import { calculateSpread } from '../../packages/fx-srv/src/services/spread-calculator';

describe('spread-calculator', () => {
  it('applies default merchant spread for regular amount', () => {
    const result = calculateSpread(3.67, 1_000);

    expect(result.spreadBps).toBe(50);
    expect(result.appliedRate).toBeCloseTo(3.68835, 6);
    expect(result.targetAmount).toBeCloseTo(3688.35, 2);
  });

  it('applies volume discount for amount above 100k', () => {
    const result = calculateSpread(1.1, 150_000, 60);

    expect(result.spreadBps).toBe(30);
    expect(result.appliedRate).toBeCloseTo(1.1033, 6);
  });

  it('applies largest discount for amount above 1M', () => {
    const result = calculateSpread(0.92, 1_200_000, 80);

    expect(result.spreadBps).toBe(15);
    expect(result.appliedRate).toBeCloseTo(0.92138, 6);
  });
});
