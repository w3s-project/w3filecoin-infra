import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

/**
 * @param {import('./types.js').BucketConnect | S3Client} target 
 */
export function connectBucket (target) {
  if (target instanceof S3Client) {
    return target
  }
  return new S3Client(target)
}

/**
 * @param {import('./types.js').TableConnect | DynamoDBClient} target 
 */
export function connectTable (target) {
  if (target instanceof DynamoDBClient) {
    return target
  }

  return new DynamoDBClient(target)
}

/** @typedef {import('sst/constructs').TableProps} TableProps */

/** @type TableProps */
export const pieceStoreTableProps = {
  fields: {
    piece: 'string',        // `bagy...content` as PieceCid of a Filecoin Piece
    storefront: 'string',   // `did:web:web3.storage`
    group: 'string',        // `did:web:free.web3.storage`
    insertedAt: 'number',   // `1690464180271` as number of milliseconds elapsed since the epoch
  },
  // piece + storefront must be unique to satisfy index constraint
  primaryIndex: { partitionKey: 'piece', sortKey: 'storefront' },
}

/** @type TableProps */
export const aggregateStoreTableProps = {
  fields: {
    piece: 'string',        // `bagy...aggregate` as PieceCid of an Aggregate (primary index, partition key)
    buffer: 'string',       // `bafy...cbor` as CID of dag-cbor block
    invocation: 'string',   // `bafy...inv` as CID of `aggregate/add` invocation
    task: 'string',         // `bafy...task` as CID of `aggregate/add` task
    stat: 'number',         // `0` as 'OFFERED' | `1` as 'APPROVED' | `2` as 'REJECTED'
    insertedAt: 'number',   // `1690464180271` as number of milliseconds elapsed since the epoch
  },
  // piece must be unique to satisfy index constraint
  primaryIndex: { partitionKey: 'piece' },
  globalIndexes: {
    indexStat: {
      partitionKey: 'stat',
      sortKey: 'insertedAt',
      projection: 'all'
    }
  }
}

/** @type TableProps */
export const inclusionStoreTableProps = {
  fields: {
    aggregate: 'string',    // `bagy...aggregate` as PieceCid of an Aggregate
    piece: 'string',        // `bagy...content` as PieceCid of a Filecoin Piece
    stat: 'number',         // `0` as 'APPROVED' | `1` as 'REJECTED'
    insertedAt: 'number',   // `1690464180271` as number of milliseconds elapsed since the epoch for piece inserted
    submitedAt: 'number',   // `1690464180271` as number of milliseconds elapsed since the epoch for aggregate submission
    resolvedAt: 'number',   // `1690464180271` as number of milliseconds elapsed since the epoch for aggregate deal resolution
    failedReason: 'string', // 'invalid piece for content'
  },
  // aggregate + piece must be unique to satisfy index constraint
  primaryIndex: { partitionKey: 'aggregate', sortKey: 'piece' },
  globalIndexes: {
    indexPiece: {
      partitionKey: 'piece',
      sortKey: 'resolvedAt',
      projection: 'all'
    }
  }
}