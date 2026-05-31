import {
  StockFileDownloadError,
  validateSyncKeyForDownload,
} from '../src/lambdas/admin-api/get-stock-file-download';

describe('validateSyncKeyForDownload', () => {
  it('returns decoded sync key for valid snapshot paths', () => {
    expect(validateSyncKeyForDownload('2025/05/30/153000.json')).toBe(
      '2025/05/30/153000.json',
    );
  });

  it('decodes URL-encoded sync keys', () => {
    expect(
      validateSyncKeyForDownload(encodeURIComponent('2025/05/30/153000.json')),
    ).toBe('2025/05/30/153000.json');
  });

  it('throws 400 when syncKey is missing', () => {
    expect(() => validateSyncKeyForDownload(undefined)).toThrow(
      new StockFileDownloadError(400, 'Missing syncKey query parameter'),
    );
  });

  it('throws 400 for non-snapshot keys', () => {
    expect(() =>
      validateSyncKeyForDownload('tienda-nube-products/products-clean.json'),
    ).toThrow(
      new StockFileDownloadError(
        400,
        'Invalid syncKey. Expected yyyy/mm/dd/HHmmss.json',
      ),
    );
  });
});
