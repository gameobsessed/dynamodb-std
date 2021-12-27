import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

export interface IPageToken {
  index: string
  hash: string | number
  sort?: string | number
}

export function encodeToken(token: Record<string, any>): string {
  return Buffer.from(JSON.stringify(marshall(token))).toString('base64')
}

export function decodeToken(token: string): IPageToken {
  return unmarshall(
    JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
  ) as any
}
