import { Storage } from './storage'

describe('storage', () => {
  it('should create default storage', () => {
    const tableName = 'test-table'
    const storage = new Storage({
      tableName,
    })

    expect(storage.tableName).toBe(tableName)
    expect(storage.indexSchema).toHaveProperty('pk')
    expect(storage.indexSchema).toEqual({
      pk: {
        hash: {
          type: 'string',
          name: '_pkh',
        },
        sort: {
          type: 'string',
          name: '_pks',
        },
      },
    })
  })

  it('should get key name', () => {
    const tableName = 'test-table'
    const storage = new Storage({
      tableName,
      indices: ['s1k'],
    })

    const hash = storage.getKeyName('s1k', 'hash')
    const sort = storage.getKeyName('s1k', 'sort')

    expect(hash).toBe('_s1h')
    expect(sort).toBe('_s1s')
  })

  it('should generate token', () => {
    const tableName = 'test-table'
    const storage = new Storage({
      tableName,
      indices: ['s1k'],
    })

    const token = storage.getPageToken('s1k', {
      _s1h: 'hashkey',
      _s1s: 'sortkey',
    })

    expect(token).toEqual({
      hash: 'hashkey',
      sort: 'sortkey',
    })
  })
})
