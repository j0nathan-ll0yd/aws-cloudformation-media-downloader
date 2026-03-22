import { defineConfig } from '@mantleframework/core'

export default defineConfig({
  name: 'media-downloader',
  database: {provider: 'aurora-dsql'},
  eventbridge: {bus: 'media-downloader'},
  dynamodb: [
    {name: 'idempotency', hashKey: 'id', attributes: [{name: 'id', type: 'S'}], ttlAttribute: 'expiration'}
  ],
  storage: [
    {name: 'files', cloudfront: true, intelligentTiering: true, assets: ['videos/default-file.mp4']}
  ],
  queues: [
    {name: 'download'},
    {name: 'send-push-notification'}
  ]
})
