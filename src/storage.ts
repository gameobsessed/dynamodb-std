export interface IKeyParams {
  type: 'string' | 'number'
  name: string
}

export interface IIndexParams {
  hash: string | IKeyParams
  sort?: string | IKeyParams
}

export interface IIndex {
  hash: IKeyParams
  sort?: IKeyParams
}

export interface IndexSchemaParams {
  pk: IIndexParams
  s1k: IIndexParams
  s2k: IIndexParams
  s3k: IIndexParams
  s4k: IIndexParams
  s5k: IIndexParams
  s6k: IIndexParams
  s7k: IIndexParams
  s8k: IIndexParams
  s9k: IIndexParams
  s10k: IIndexParams
  s11k: IIndexParams
}

export type IndexName = keyof IndexSchemaParams

export type IndexSchema = Record<IndexName, IIndex>

export interface IStorageParams {
  tableName: string
  indices?: IndexName[]
}

export interface IStorage {}

export class Storage implements IStorage {
  readonly indexSchema: Partial<IndexSchema>
  readonly tableName: string

  constructor({ tableName, indices = [] }: IStorageParams) {
    this.tableName = tableName
    const indicesNames = indices.some((el) => el === 'pk')
      ? indices
      : ['pk', ...indices]
    this.indexSchema = Object.assign(
      {},
      ...indicesNames.map((index) => fromIndexString(index))
    )
  }

  getKeyName(indexName: IndexName, keyType: 'hash' | 'sort') {
    return this.indexSchema[indexName]?.[keyType]?.name
  }

  getPageToken(indexName: IndexName, lastKey: Record<string, string | number>) {
    const hash = this.getKeyName(indexName, 'hash')!
    const sort = this.getKeyName(indexName, 'sort')

    return Object.assign(
      {
        hash: lastKey[hash],
      },
      sort
        ? {
            sort: lastKey[sort],
          }
        : undefined
    )
  }
}

export function fromIndexString(index: string) {
  const prefix = `_${index.substr(0, 2)}`
  return {
    [index]: {
      hash: fromKeyString(`${prefix}h`),
      sort: fromKeyString(`${prefix}s`),
    },
  }
}

export function fromKeyString(name: string) {
  return {
    type: 'string',
    name,
  }
}
