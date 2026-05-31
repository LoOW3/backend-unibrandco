import {
  parseTiendanubeOrderIdFromDigipCodigo,
  ParseDigipCodigoError,
} from '../src/shared/parse-digip-codigo';

describe('parseTiendanubeOrderIdFromDigipCodigo', () => {
  it('strips TN suffix', () => {
    expect(parseTiendanubeOrderIdFromDigipCodigo('1984097529TN')).toBe(1984097529);
  });

  it('accepts codigo without suffix', () => {
    expect(parseTiendanubeOrderIdFromDigipCodigo('1984097529')).toBe(1984097529);
  });

  it('throws for invalid codigo', () => {
    expect(() => parseTiendanubeOrderIdFromDigipCodigo('abcTN')).toThrow(ParseDigipCodigoError);
  });
});
