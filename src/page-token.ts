import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

export interface IPageToken {
  index: string
  hash: string | number
  sort?: string | number
}

export function encodeToken({ index, hash, sort }: IPageToken): string {
  const t = [index, hash, sort].filter((item) => typeof item !== 'undefined')
  return Buffer.from(JSON.stringify(marshall({ t }))).toString('base64')
}

export function decodeToken(token: string): IPageToken {
  const [index, hash, sort] = (
    unmarshall(JSON.parse(Buffer.from(token, 'base64').toString('utf8'))) as any
  ).t

  return Object.assign(
    {
      index,
      hash,
    },
    sort ? { sort } : {}
  )
}
