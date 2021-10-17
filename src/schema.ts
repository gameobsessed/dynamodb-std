import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
  DeleteCommandInput,
  GetCommandInput,
  PutCommandInput,
  QueryCommandInput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb'
import {
  ConditionExpressionPredicate,
  ExpressionAttributes,
  ConditionExpression,
  equals,
  beginsWith,
  serializeConditionExpression,
} from '@aws/dynamodb-expressions'
import { IndexName, Storage } from './storage'
import { IPageToken } from './page-token'

export interface KeyConfig {
  keys: string[]
  delimiter: string
}

export type KeyFactory<T> = (entity: T) => string

export type KeyDefinition<T> = string | string[] | KeyConfig | KeyFactory<T>

export interface IIndexDefinition<T> {
  hash: KeyDefinition<T>
  sort?: KeyDefinition<T>
}

export interface IKeyGenerator<T> {
  hash: KeyFactory<T>
  sort?: KeyFactory<T>
}

export type ISchemaDefinition<T> = Record<IndexName, IIndexDefinition<T>>

export interface IRepositoryParams<T> {
  storage: Storage
  schema: Partial<ISchemaDefinition<T>>
}

export interface IQueryParams {
  limit: number
  indexName: IndexName
  hash: string | number
  sort?: string | number | ConditionExpressionPredicate
  startKey?: IPageToken
}

export interface IScanParams {
  indexName?: IndexName
  startKey?: IPageToken
  limit: number
}

export class Schema<T> {
  storage: Storage
  schema: Partial<Record<IndexName, IKeyGenerator<T>>>

  constructor(params: IRepositoryParams<T>) {
    this.storage = params.storage
    this.schema = Object.fromEntries(
      Object.entries(params.schema).map(([key, { hash, sort }]) => {
        const index = this.storage.indexSchema[key as IndexName]

        if (!index) {
          throw new Error(`Index ${key} is not defined in storage`)
        }

        return [
          key,
          Object.assign(
            {
              [index.hash.name]: keyFrom(hash),
            },
            sort &&
              index.sort && {
                [index.sort.name]: keyFrom(sort),
              }
          ),
        ]
      })
    )
  }

  indexData(entity: Partial<T>, indexName?: IndexName) {
    const indexes: IndexName[] = (indexName
      ? [indexName]
      : Object.keys(this.schema)) as IndexName[]

    return indexes.reduce((acc, index) => {
      const schema = this.schema[index]

      return Object.assign(
        acc,
        schema &&
          Object.fromEntries(
            Object.entries(schema).map(([key, generate]) => [
              key,
              typeof generate === 'function' ? generate(entity) : undefined,
            ])
          )
      )
    }, {})
  }

  putParams(entity: T): PutCommandInput {
    const indexData = this.indexData(entity)

    return {
      TableName: this.storage.tableName,
      Item: {
        ...entity,
        ...indexData,
      },
    }
  }

  getParams(keyParams: Partial<T>): GetCommandInput {
    const indexData = this.indexData(keyParams, 'pk')

    return {
      TableName: this.storage.tableName,
      Key: indexData,
    }
  }

  deleteParams(keyParams: Partial<T>): DeleteCommandInput {
    const indexData = this.indexData(keyParams, 'pk')

    return {
      TableName: this.storage.tableName,
      Key: indexData,
    }
  }

  queryParams({
    indexName,
    hash,
    sort,
    startKey,
    limit,
  }: IQueryParams): QueryCommandInput {
    const indexExpressionAttributes = new ExpressionAttributes()
    const sortType = typeof sort
    const indexHashKey = this.storage.getKeyName(indexName, 'hash')!
    const indexSortKey = this.storage.getKeyName(indexName, 'sort')
    const sortPredicate = (sortType === 'string' || sortType === 'number'
      ? equals(sort)
      : sort) as ConditionExpressionPredicate
    const sortConditions = sort && { subject: indexSortKey, ...sortPredicate }
    const indexConditions: ConditionExpression = {
      type: 'And',
      conditions: [
        {
          subject: indexHashKey,
          ...equals(hash),
        },
        sort && sortConditions,
      ].filter(Boolean) as ConditionExpression[],
    }

    const expression = serializeConditionExpression(
      indexConditions,
      indexExpressionAttributes
    )

    return {
      Limit: limit,
      TableName: this.storage.tableName,
      IndexName: indexName,
      KeyConditionExpression: expression,
      ExpressionAttributeNames: indexExpressionAttributes.names,
      ExpressionAttributeValues: unmarshall(
        indexExpressionAttributes.values as any
      ),
      ExclusiveStartKey:
        startKey &&
        Object.assign(
          {
            [indexHashKey]: startKey.hash,
          },
          indexSortKey && {
            [indexSortKey]: startKey.sort,
          }
        ),
    }
  }

  scanParams({
    indexName = 'pk',
    startKey,
    limit,
  }: IScanParams): ScanCommandInput {
    const indexHashKey = this.storage.getKeyName(indexName, 'hash')!
    const indexSortKey = this.storage.getKeyName(indexName, 'sort')

    return Object.assign(
      {
        Limit: limit,
        TableName: this.storage.tableName,
        IndexName: indexName,
      },
      startKey && {
        ExclusiveStartKey: Object.assign(
          {
            [indexHashKey]: startKey.hash,
          },
          indexSortKey && {
            [indexSortKey]: startKey.sort,
          }
        ),
      }
    )
  }
}

function keyFrom<T extends Record<string, any>>(config: KeyDefinition<T>) {
  const type = typeof config

  if (type === 'string') {
    return keyFromString(config as string)
  }

  if (type === 'function') {
    return keyFromFunction(config as KeyFactory<T>)
  }

  if (Array.isArray(config)) {
    return keyFromArray(config)
  }

  return keyFromObject(config as KeyConfig)
}

function keyFromString<T extends Record<string, any>>(key: string) {
  return function (entity: T): string | number {
    return entity[key]
  }
}

function keyFromArray<T extends Record<string, any>>(
  keys: string[],
  delimiter: string = ':'
) {
  return function (entity: T): string {
    return keys.map((key) => entity[key]).join(delimiter)
  }
}

function keyFromObject<T extends Record<string, any>>({
  keys,
  delimiter,
}: KeyConfig) {
  const generator = keyFromArray(keys, delimiter)

  return function (entity: T): string | number {
    return generator(entity)
  }
}

function keyFromFunction<T extends Record<string, any>>(
  factory: KeyFactory<T>
) {
  return factory
}

// function updateExpression(condition: Record<string, any>) {
//   return Object.keys(condition)
//     .map((key) => `${key} = :${key.toLowerCase()}`)
//     .join(', ')
// }

function conditionToExpression(condition: Record<string, any>) {
  return Object.keys(condition)
    .map((key) => `${key} = :${key.toLowerCase()}`)
    .join(' AND ')
}

function conditionsToValues(condition: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(condition).map(([key, value]) => [
      `:${key.toLowerCase()}`,
      value,
    ])
  )
}
