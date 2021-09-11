import { decodeToken, encodeToken } from './page-token'
import { IndexName } from './storage'
import { v4 as uuid } from 'uuid'

describe('page-token', () => {
  it('should encode and decode string token', () => {
    const index: IndexName = 's1k'
    const hash = uuid()
    const sort = 'sort'
    const encoded = encodeToken({ index, hash, sort })
    const decoded = decodeToken(encoded)

    expect(typeof encoded).toBe('string')
    expect(decoded).toEqual({
      index,
      hash,
      sort,
    })
  })

  it('should encode and decode number token', () => {
    const index: IndexName = 's1k'
    const hash = uuid()
    const sort = 1000
    const encoded = encodeToken({ index, hash, sort })
    const decoded = decodeToken(encoded)

    expect(typeof encoded).toBe('string')
    expect(decoded).toEqual({
      index,
      hash,
      sort,
    })
  })

  it('should encode and decode hash only token', () => {
    const index: IndexName = 's1k'
    const hash = uuid()
    const encoded = encodeToken({ index, hash })
    const decoded = decodeToken(encoded)

    expect(typeof encoded).toBe('string')
    expect(decoded).toEqual({
      index,
      hash,
    })
    expect('sort' in decoded).toBeFalsy()
  })
})
