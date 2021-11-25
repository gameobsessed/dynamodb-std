import { beginsWith } from '@aws/dynamodb-expressions'
import { Schema } from './schema'
import { Storage } from './storage'

describe('repository', () => {
  const storage = new Storage({
    indices: ['s1k'],
    tableName: 'table',
  })

  it('schema string', () => {
    const repository = new Schema({
      storage,
      schema: {
        pk: {
          hash: 'id',
          sort: 'id',
        },
      },
    })
    const entity = {
      id: 'aa-123',
    }

    const result = repository.indexData(entity, 'pk')

    expect(result).toEqual({
      _pkh: 'aa-123',
      _pks: 'aa-123',
    })
  })

  it('schema array', () => {
    const repository = new Schema({
      storage,
      schema: {
        pk: {
          hash: 'id',
          sort: ['type', 'category'],
        },
      },
    })

    const entity = {
      id: 'aa-123',
      type: 'game',
      category: 'arcade',
    }

    const result = repository.indexData(entity, 'pk')

    expect(result).toEqual({
      _pkh: 'aa-123',
      _pks: 'game:arcade',
    })
  })

  it('schema object', () => {
    const repository = new Schema({
      storage,
      schema: {
        pk: {
          hash: 'id',
          sort: {
            keys: ['type', 'category'],
            delimiter: '#',
          },
        },
      },
    })

    const entity = {
      id: 'aa-123',
      type: 'game',
      category: 'arcade',
    }

    const result = repository.indexData(entity, 'pk')

    expect(result).toEqual({
      _pkh: 'aa-123',
      _pks: 'game#arcade',
    })
  })

  it('schema function', () => {
    const repository = new Schema({
      storage,
      schema: {
        pk: {
          hash: 'id',
          sort(entity: any) {
            return `${entity.type}-${entity.category}`
          },
        },
      },
    })

    const entity = {
      id: 'aa-123',
      type: 'game',
      category: 'arcade',
    }

    const result = repository.indexData(entity, 'pk')

    expect(result).toEqual({
      _pkh: 'aa-123',
      _pks: 'game-arcade',
    })
  })

  it('schema key data', () => {
    const repository = new Schema({
      storage,
      schema: {
        pk: {
          hash: 'id',
          sort: 'id',
        },
        s1k: {
          hash: (entity: any) => `type:${entity.type}`,
          sort: 'category',
        },
      },
    })

    const entity = {
      id: 'aa-123',
      type: 'game',
      category: 'arcade',
    }

    const result = repository.indexData(entity)

    expect(result).toEqual({
      _pkh: 'aa-123',
      _pks: 'aa-123',
      _s1h: 'type:game',
      _s1s: 'arcade',
    })
  })

  it('should throw error if index is not defined in storage', () => {
    const notDefinedIndex = 's2k'
    const throwable = () =>
      new Schema({
        storage,
        schema: {
          pk: {
            hash: 'id',
            sort: 'id',
          },
          [notDefinedIndex]: {
            hash: 'category',
          },
        },
      })

    expect(throwable).toThrowError(
      `Index ${notDefinedIndex} is not defined in storage`
    )
  })

  describe('db client params', () => {
    const repository = new Schema({
      storage,
      schema: {
        pk: {
          hash: 'id',
          sort: 'id',
        },
        s1k: {
          hash: (entity: any) => `type:${entity.type}`,
          sort: 'category',
        },
      },
    })

    const entity = {
      id: 'aa-123',
      type: 'game',
      category: 'arcade',
    }

    it('should generate put params', () => {
      const result = repository.putParams(entity)

      expect(result).toEqual({
        TableName: 'table',
        Item: {
          id: 'aa-123',
          type: 'game',
          category: 'arcade',
          _pkh: 'aa-123',
          _pks: 'aa-123',
          _s1h: 'type:game',
          _s1s: 'arcade',
        },
      })
    })

    it('should generate get params', () => {
      const result = repository.getParams(entity)

      expect(result).toEqual({
        TableName: 'table',
        Key: {
          _pkh: 'aa-123',
          _pks: 'aa-123',
        },
      })
    })

    it('should generate delete params', () => {
      const result = repository.deleteParams(entity)

      expect(result).toEqual({
        TableName: 'table',
        Key: {
          _pkh: 'aa-123',
          _pks: 'aa-123',
        },
      })
    })

    it('should generate default query params', () => {
      const result = repository.queryParams({
        indexName: 'pk',
        hash: entity.id,
        sort: entity.type,
        limit: 20,
      })

      expect(result).toEqual({
        Limit: 20,
        TableName: 'table',
        IndexName: 'pk',
        KeyConditionExpression: '(#attr0 = :val1) AND (#attr2 = :val3)',
        ExpressionAttributeNames: {
          '#attr0': '_pkh',
          '#attr2': '_pks',
        },
        ExpressionAttributeValues: {
          ':val1': 'aa-123',
          ':val3': 'game',
        },
      })
    })

    it('should generate query params with no sort', () => {
      const result = repository.queryParams({
        indexName: 'pk',
        hash: entity.id,
        limit: 20,
      })

      expect(result).toEqual({
        Limit: 20,
        TableName: 'table',
        IndexName: 'pk',
        KeyConditionExpression: '#attr0 = :val1',
        ExpressionAttributeNames: {
          '#attr0': '_pkh',
        },
        ExpressionAttributeValues: {
          ':val1': 'aa-123',
        },
      })
    })

    it('should generate query params with custom sort', () => {
      const result = repository.queryParams({
        indexName: 'pk',
        hash: entity.id,
        sort: beginsWith(entity.type),
        limit: 20,
      })

      expect(result).toEqual({
        Limit: 20,
        TableName: 'table',
        IndexName: 'pk',
        KeyConditionExpression:
          '(#attr0 = :val1) AND (begins_with(#attr2, :val3))',
        ExpressionAttributeNames: {
          '#attr0': '_pkh',
          '#attr2': '_pks',
        },
        ExpressionAttributeValues: {
          ':val1': 'aa-123',
          ':val3': 'game',
        },
      })
    })

    it('should generate query params', () => {
      const result = repository.queryParams({
        indexName: 's1k',
        keyParams: entity,
        limit: 20,
      })

      expect(result).toEqual({
        Limit: 20,
        TableName: 'table',
        IndexName: 's1k',
        KeyConditionExpression: '#attr0 = :val1',
        ExpressionAttributeNames: {
          '#attr0': '_s1h',
        },
        ExpressionAttributeValues: {
          ':val1': 'type:game',
        },
        ExclusiveStartKey: undefined,
      })
    })

    it('should generate scan params', () => {
      const result = repository.scanParams({ limit: 20 })

      expect(result).toEqual({
        Limit: 20,
        TableName: 'table',
        IndexName: 'pk',
      })
    })
  })
})
