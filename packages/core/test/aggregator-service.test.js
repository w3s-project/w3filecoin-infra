import { test as filecoinApiTest } from '@web3-storage/filecoin-api/test'
import * as Signer from '@ucanto/principal/ed25519'
import { Consumer } from 'sqs-consumer'
import pWaitFor from 'p-wait-for'
import delay from 'delay'
import { fromString } from 'uint8arrays/from-string'
import { decode as JSONdecode } from '@ipld/dag-json'

import { tesWorkflowWithMultipleQueues as test } from './helpers/context.js'
import { createDynamodDb, createS3, createSQS, createQueue } from './helpers/resources.js'
import { getStores, getQueues } from './helpers/aggregator-context.js'

/**
 * @typedef {import('./helpers/context.js').QueueContext} QueueContext
 */

const queueNames = ['pieceQueue', 'bufferQueue', 'aggregateOfferQueue', 'pieceAcceptQueue']

test.before(async (t) => {
  await delay(1000)

  const { client: sqsClient } = await createSQS()
  const { client: s3Client, stop: s3Stop } = await createS3({ port: 9000 })
  const { client: dynamoClient, stop: dynamoStop} = await createDynamodDb()

  Object.assign(t.context, {
    s3: s3Client,
    dynamoClient,
    sqsClient,
    stop: async () => {
      await s3Stop()
      await dynamoStop()
    }
  })
})

test.beforeEach(async t => {
  await delay(1000)

  /** @type {Record<string, QueueContext>} */
  const queues = {}
  // /** @type {import('@aws-sdk/client-sqs').Message[]} */
  /** @type {Map<string, unknown[]>} */
  const queuedMessages = new Map()

  for (const name of queueNames) {
    const { queueUrl, queueName } = await createQueue(t.context.sqsClient)
    queuedMessages.set(name, [])

    const queueConsumer = Consumer.create({
      queueUrl: queueUrl,
      sqs: t.context.sqsClient,
      handleMessage: (message) => {
        // @ts-expect-error may not have body
        const decodedBytes = fromString(message.Body)
        const decodedMessage = JSONdecode(decodedBytes)
        const messages = queuedMessages.get(name) || []
        messages.push(decodedMessage)
        return Promise.resolve()
      }
    })

    queues[name] = {
      queueName: queueName,
      queueUrl: queueUrl,
      queueConsumer,
    }
  }

  for (const [, q] of Object.entries(queues)) {
    q.queueConsumer.start()
    await pWaitFor(() => q.queueConsumer.isRunning)
  }

  Object.assign(t.context, {
    queues,
    queuedMessages
  })
})

test.afterEach(async t => {
  for (const [, q] of Object.entries(t.context.queues)) {
    q.queueConsumer.stop()
    await delay(1000)
  }
})

test.after(async t => {
  await t.context.stop()
})

for (const [title, unit] of Object.entries(filecoinApiTest.service.aggregator)) {
  const define = title.startsWith('only ')
    // eslint-disable-next-line no-only-tests/no-only-tests
    ? test.only
    : title.startsWith('skip ')
    ? test.skip
    : test

  define(title, async (t) => {
    const queues = getQueues(t.context)
    const stores = await getStores(t.context)

    // context
    const aggregatorSigner = await Signer.generate()
    const dealerSigner = await Signer.generate()

    await unit(
      {
        ok: (actual, message) => t.truthy(actual, message),
        equal: (actual, expect, message) =>
          t.is(actual, expect, message ? String(message) : undefined),
        deepEqual: (actual, expect, message) =>
          t.deepEqual(actual, expect, message ? String(message) : undefined),
      },
      {
        id: aggregatorSigner,
        dealerId: dealerSigner,
        ...stores,
        ...queues,
        errorReporter: {
          catch(error) {
            t.fail(error.message)
          },
        },
        queuedMessages: t.context.queuedMessages,
        validateAuthorization: () => ({ ok: {} })
      }
    )
  })
}
