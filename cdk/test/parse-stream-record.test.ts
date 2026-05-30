import type { DynamoDBRecord } from 'aws-lambda';
import { marshall } from '@aws-sdk/util-dynamodb';

import type { StockChangeItem } from '../src/shared/patagonia-stock.types';
import { parseStreamRecord } from '../src/lambdas/tiendanube-stock-sync/parse-stream-record';

function buildChangedItem(codigoArticulo: string): StockChangeItem {
  return {
    CodigoArticulo: codigoArticulo,
    UnidadesDisponibles: 10,
    UnidadesReservadas: 0,
    UnidadesBloqueadas: 0,
    UnidadesADespachar: 0,
    UnidadesEnRecepcion: 0,
    UnidadesTransitoInterno: 0,
    UnidadesVencidas: 0,
    UnidadesPedidas: 0,
  };
}

function buildInsertRecord(changedItems: StockChangeItem[]): DynamoDBRecord {
  return {
    eventName: 'INSERT',
    dynamodb: {
      NewImage: marshall({
        pk: 'SYNC#2025/05/30/153000.json',
        changedItems,
      }) as DynamoDBRecord['dynamodb'] extends { NewImage?: infer T } ? T : never,
    },
  };
}

describe('parseStreamRecord', () => {
  it('extracts pk and changedItems from INSERT records', () => {
    const changedItems = [buildChangedItem('SS03006')];

    const result = parseStreamRecord(buildInsertRecord(changedItems));

    expect(result).toEqual({
      pk: 'SYNC#2025/05/30/153000.json',
      changedItems,
    });
  });

  it('returns undefined for non-INSERT records', () => {
    const result = parseStreamRecord({
      eventName: 'MODIFY',
      dynamodb: {
        NewImage: marshall({
          pk: 'SYNC#2025/05/30/153000.json',
          changedItems: [],
        }) as DynamoDBRecord['dynamodb'] extends { NewImage?: infer T } ? T : never,
      },
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined when NewImage is missing required fields', () => {
    const result = parseStreamRecord({
      eventName: 'INSERT',
      dynamodb: {
        NewImage: marshall({ pk: 'SYNC#2025/05/30/153000.json' }) as DynamoDBRecord['dynamodb'] extends { NewImage?: infer T } ? T : never,
      },
    });

    expect(result).toBeUndefined();
  });
});
