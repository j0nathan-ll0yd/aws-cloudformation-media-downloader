import { defineConfig } from '@mantleframework/core'

export default defineConfig({
  name: 'media-downloader',
  database: {provider: 'aurora-dsql'},
  backend: {
    s3: {
      bucket: 'lifegames-media-downloader-tfstate',
      key: 'infra.tfstate',
      region: 'us-west-2',
      encrypt: true,
      dynamodbTable: 'MediaDownloader-TerraformStateLock',
      workspaceKeyPrefix: 'env'
    }
  },
  customVariables: [
    {
      name: 'resource_prefix',
      type: 'string',
      description: 'DEPRECATED: Legacy prefix for S3 bucket names only. New resources use module.core.name_prefix. Do not replicate in new instances. See ADR 0001.',
      validation: {condition: 'contains(["stag", "prod"], var.resource_prefix)', errorMessage: "Resource prefix must be 'stag' or 'prod'."}
    },
    {name: 'download_reserved_concurrency', type: 'number', description: 'Reserved concurrency for StartFileUpload Lambda', default: '10'},
    {name: 'api_throttle_burst_limit', type: 'number', description: 'API Gateway throttle burst limit', default: '100'},
    {name: 'api_throttle_rate_limit', type: 'number', description: 'API Gateway throttle rate limit', default: '50'},
    {name: 'api_quota_limit', type: 'number', description: 'API Gateway daily quota limit', default: '10000'},
    {name: 'dsql_deletion_protection', type: 'bool', description: 'Enable deletion protection for DSQL cluster', default: 'true'},
    {name: 'enable_cloudwatch_dashboard', type: 'bool', description: 'Enable CloudWatch dashboard (costs $3/month per environment)', default: 'false'},
    {name: 'enable_cloudwatch_alarms', type: 'bool', description: 'Enable CloudWatch alarms (first 10 free, then $0.10/alarm)', default: 'false'},
    {
      name: 'cors_allowed_origins',
      type: 'list(string)',
      description: 'Origins allowed to fetch media files via CORS (empty list disables CORS)',
      default: '[]',
      validation: {condition: 'alltrue([for o in var.cors_allowed_origins : can(regex("^https?://", o))])', errorMessage: 'Each origin must start with http:// or https://.'}
    }
  ],
  eventbridge: {
    bus: 'MediaDownloader',
    sqsTargets: [
      {
        detailType: 'DownloadRequested',
        queue: 'DownloadQueue',
        inputTransformer: {
          inputPaths: {
            fileId: '$.detail.fileId',
            sourceUrl: '$.detail.sourceUrl',
            correlationId: '$.detail.correlationId',
            userId: '$.detail.userId'
          },
          inputTemplate: `{
  "fileId": <fileId>,
  "sourceUrl": <sourceUrl>,
  "correlationId": <correlationId>,
  "userId": <userId>,
  "attempt": 1
}`
        }
      }
    ]
  },
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
        principalSecret: 'apns.staging.certificate',
        resourceName: 'apns'
      }
    ]
  },
  dynamodb: [
    {name: 'idempotency', tableNameOverride: '${module.core.name_prefix}-MediaDownloader-Idempotency', hashKey: 'id', attributes: [{name: 'id', type: 'S'}], ttlAttribute: 'expiration'}
  ],
  storage: [
    {name: 'files', bucketNameOverride: 'lifegames-${var.resource_prefix}-media-files-${module.core.account_id}', cloudfront: true, intelligentTiering: true, assets: ['videos/default-file.mp4']}
  ],
  queues: [
    {name: 'DownloadQueue'},
    {name: 'SendPushNotification', envAlias: 'SNS_QUEUE_URL'}
  ],
  cloudfront: {
    apiDistribution: {
      geoRestriction: {type: 'whitelist', locations: ['US']},
      forwardedHeaders: ['X-API-Key', 'Authorization', 'User-Agent'],
      cacheTtl: {default: 0, min: 0, max: 0}
    }
  },
  authorizer: {cacheTtl: 0}
})
