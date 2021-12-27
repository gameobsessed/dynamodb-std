import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

export type IPageToken = Record<string, any>

export function encodeToken(token: IPageToken): string {
  return Buffer.from(JSON.stringify(marshall(token))).toString('base64')
}

export function decodeToken(token: string): IPageToken {
  return unmarshall(
    JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
  ) as any
}
