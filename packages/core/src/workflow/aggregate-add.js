import { Aggregate, Piece } from '@web3-storage/data-segment'
import { Broker } from '@web3-storage/filecoin-client'
import { decode as aggregateDecode } from '../data/aggregate.js'

/**
 * @typedef {import('@web3-storage/data-segment').PieceLink} PieceLink
 * @typedef {import('../data/types.js').Buffer<PieceLink>} Buffer
 * @typedef {import('../data/types.js').Aggregate<PieceLink>} Aggregate
 */

/**
 * @param {object} props
 * @param {import('@web3-storage/filecoin-api/types').Store<Buffer>} props.bufferStoreClient
 * @param {import('@web3-storage/filecoin-api/types').Store<Aggregate>} props.aggregateStoreClient
 * @param {string} props.aggregateRecord
 * @param {import('@web3-storage/filecoin-client/types').InvocationConfig} props.invocationConfig
 * @param {import('@ucanto/principal/ed25519').ConnectionView<any>} props.brokerServiceConnection
 */
export async function addAggregate ({
  bufferStoreClient,
  aggregateStoreClient,
  aggregateRecord,
  invocationConfig,
  brokerServiceConnection
}) {
  const bufferRef = await aggregateDecode.message(aggregateRecord)
  const bufferReference = await getAggregateBuffer(bufferRef, bufferStoreClient)
  if (bufferReference.error) {
    return {
      error: bufferReference.error
    }
  }

  const aggregate = Aggregate.build({
    pieces: bufferReference.ok.pieces.map(p => ({
      link: p.piece,
      // TODO: size should not be needed once encoded, so using random
      size: Piece.PaddedSize.from(128)
    })),
  })

  // Add aggregate to broker
  const add = await Broker.aggregateAdd(
    invocationConfig,
    aggregate.link,
    bufferReference.ok.pieces.map(p => p.piece),
    {
      tenantId: bufferReference.ok.storefront,
    },
    { connection: brokerServiceConnection }
  )

  if (add.out.error) {
    return {
      error: add.out.error
    }
  }

  // Save aggregate
  const aggregateStored = await aggregateStoreClient.put({
    piece: aggregate.link,
    buffer: bufferRef.buffer,
    task: add.ran.link(),
    invocation: add.ran.link(),
    insertedAt: Date.now(),
    storefront: bufferReference.ok.storefront,
    group: bufferReference.ok.group,
    stat: 0
  })
  if (aggregateStored.error) {
    return {
      error: aggregateStored.error
    }
  }

  return {
    ok: 1
  }
}

/**
 * @param {{ piece?: import("@web3-storage/data-segment").PieceLink; buffer: any; invocation?: import("multiformats").UnknownLink | undefined; task?: import("multiformats").UnknownLink | undefined; insertedAt?: number; stat?: import("../data/types.js").AggregateStatus; }} bufferRef
 * @param {import('@web3-storage/filecoin-api/types').Store<Buffer>} storeClient
 */
async function getAggregateBuffer (bufferRef, storeClient) {
  const getBufferRes = await storeClient.get(
    `${bufferRef.buffer}/${bufferRef.buffer}`
  )

  return getBufferRes
}