import { buildStockS3Key } from '../src/lambdas/stock-sync/s3-key';

describe('buildStockS3Key', () => {
  it('builds UTC path yyyy/mm/dd/HHmmss.json', () => {
    const date = new Date('2025-05-30T15:12:45.000Z');
    expect(buildStockS3Key(date)).toBe('2025/05/30/151245.json');
  });

  it('pads single-digit month and day', () => {
    const date = new Date('2025-01-05T09:03:07.000Z');
    expect(buildStockS3Key(date)).toBe('2025/01/05/090307.json');
  });
});
