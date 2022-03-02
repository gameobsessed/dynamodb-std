# dynamodb-std
Simple DynamoDB single-table design implementation (aws-sdk-v3 compatible)

## DON'T USE IT IN PRODUCTION CODE
Although we do, this library is in the early stage of development, not feature full, and doesn't have a stable API, which means it may have breaking changes at any time. 

## DO USE IT FOR TESTING AND LEARNING STD
Please, give this library a chance, try it out, and give your feedback. If you find any issues, please use GitHub to report and we will try to fix them. It would be even better if you take an active part in the development of this library.

## Usage
In accordance with [single-table design](https://www.youtube.com/watch?v=BnDKD_Zv0og) all the data you need for a [domain](https://en.wikipedia.org/wiki/Domain-driven_design) in your application or microservice you may store in one DynamoDB table. With `dynamodb-std`, you may defined this table using Storage:

```typescript
import { Storage } from 'dynamodb-std'

export const storage = new Storage({
  tableName: process.env.TABLE_NAME,
  indices: ['s1k', 's2k'],
})
```

Then, for each data model you have in you application, you need to define a schema: 

```typescript
export interface IUser {
  id: string
  role: string
  status: string
  modified: number
}

export const userSchema = new Schema<IUser>({
  storage,
  schema: {
    pk: {
      hash: 'id',
      sort: 'id',
    },
    s1k: {
      hash: () => 'BYROLE',
      sort: 'role',
    },
    s2k: {
      hash: () => 'BYSTATUS',
      sort: ['status', 'modified'],
    },
  },
})
```
And use it in you repository (check `@aws-sdk/lib-dynamodb` to setup ddbDocClient): 

```typescript
import { ddbDocClient as client } from '../utils/db'
import { decodeToken, encodeToken } from 'dynamodb-std'

export async function put(user: IUser) {
  const commandInput: PutCommandInput = userSchema.putParams(user)
  await client.send(new PutCommand(commandInput))

  return user
}

export async function getById(params: Pick<IUser, 'id'>): Promise<IUser | undefined> {
  const commandInput = userSchema.getParams(params)
  const { Item } = await client.send(new GetCommand(commandInput))

  return Item as IUser
}

export async function delete(params: Pick<IUser, 'id'>) {
  const commandInput = userSchema.deleteParams(params)
  return await client.send(new DeleteCommand(commandInput))
}

export interface IListParams {
  limit?: number
  nextToken?: string | null
}

export async function list({ limit = 20, nextToken }: IListParams = {}) {
  const startKey = nextToken ? decodeToken(nextToken) : undefined
  const indexName = 's1k'
  const commandInput = userSchema.queryParams({
    limit,
    indexName,
    hash: 'BYROLE',
    startKey,
  })

  const { Items, LastEvaluatedKey } = await client.send(
    new QueryCommand(commandInput)
  )

  return {
    items: (Items || []) as IUser[],
    nextToken:
      LastEvaluatedKey &&
      encodeToken({
        index: indexName,
        ...userSchema.storage.getPageToken(indexName, LastEvaluatedKey),
      }),
  }
}
```