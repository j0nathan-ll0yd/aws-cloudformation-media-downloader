import { defineConfig } from '@mantleframework/core'

export default defineConfig({
  name: 'media-downloader',
  database: {provider: 'aurora-dsql'},
  eventbridge: {bus: 'media-downloader'},
  observability: {
    adot: true,
    metricsNamespace: 'MediaDownloader'
  },
  secrets: {
    provider: 'sops',
    filePattern: 'secrets.{env}.enc.yaml'
  },
  sns: {
    topics: [
      {name: 'push-notifications'},
      {name: 'operations-alerts'}
    ],
    platformApplications: [
      {
        name: 'media-downloader',
        platform: 'APNS_SANDBOX',
        credentialSecret: 'apns.staging.privateKey',
        principalSecret: 'apns.staging.certificate'
      }
    ]
  },
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
