import {
  S3Client,
} from '@aws-sdk/client-s3'
import { StoreOperationFailed } from '@web3-storage/filecoin-api/errors'
import * as Store from './agent/store.js'

/**
 * Abstraction layer with Factory to perform operations on bucket storing
 * handled receipts.
 *
 * @param {string} region
 * @param {string} invocationBucketName
 * @param {string} workflowBucketName
 * @param {import('@aws-sdk/client-s3').ServiceInputTypes} [options]
 */
export function createReceiptStore(region, invocationBucketName, workflowBucketName, options = {}) {
  const s3client = new S3Client({
    region,
    ...options,
  })
  return useReceiptStore(s3client, invocationBucketName, workflowBucketName)
}

/**
 * @param {S3Client} s3client
 * @param {string} invocationBucketName
 * @param {string} workflowBucketName
 * @returns {import('@web3-storage/filecoin-api/storefront/api').ReceiptStore}
 */
export const useReceiptStore = (s3client, invocationBucketName, workflowBucketName) => {
  const store = Store.open({
    // @ts-ignore
    connection: { channel: s3client },
    region: typeof s3client.config.region === 'string' ? s3client.config.region : 'us-west-2',
    buckets: {
      index: { name: invocationBucketName },
      message: { name: workflowBucketName },
    }
  })
  
  return {
    put: async (record) => {
      return {
        error: new StoreOperationFailed('no new receipt should be put by storefront')
      }
    },
    /**
     * @param {import('@ucanto/interface').UnknownLink} taskCid
     */
    get: (taskCid) =>  
      // @ts-expect-error - need to align RecordNotFoundError
      Store.getReceipt(store, taskCid),
    has: async (record) => {
      return {
        error: new StoreOperationFailed('no receipt should checked by storefront')
      }
    }
  }
}
