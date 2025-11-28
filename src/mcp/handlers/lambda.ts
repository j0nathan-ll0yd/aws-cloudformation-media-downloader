/**
 * Lambda query handler for MCP server
 * Provides Lambda function configurations and dependencies
 */

export async function handleLambdaQuery(args: any) {
  const { lambda, query } = args;

  // Lambda function configurations
  const lambdaConfigs = {
    ListFiles: {
      runtime: 'nodejs22.x',
      memory: 256,
      timeout: 30,
      trigger: 'API Gateway GET /files',
      description: 'List user\'s available files',
      dependencies: ['ElectroDB', 'DynamoDB'],
      env: ['TABLE_NAME'],
    },
    LoginUser: {
      runtime: 'nodejs22.x',
      memory: 256,
      timeout: 30,
      trigger: 'API Gateway POST /auth/login',
      description: 'Authenticate user with Sign In With Apple',
      dependencies: ['ElectroDB', 'jose', 'jwks-rsa'],
      env: ['TABLE_NAME', 'APPLE_CLIENT_ID'],
    },
    RegisterDevice: {
      runtime: 'nodejs22.x',
      memory: 256,
      timeout: 30,
      trigger: 'API Gateway POST /devices',
      description: 'Register iOS device for push notifications',
      dependencies: ['ElectroDB', 'SNS'],
      env: ['TABLE_NAME', 'PLATFORM_APPLICATION_ARN'],
    },
    StartFileUpload: {
      runtime: 'nodejs22.x',
      memory: 256,
      timeout: 30,
      trigger: 'API Gateway POST /files/upload',
      description: 'Initiate file upload to S3',
      dependencies: ['ElectroDB', 'S3'],
      env: ['TABLE_NAME', 'BUCKET_NAME'],
    },
    WebhookFeedly: {
      runtime: 'nodejs22.x',
      memory: 512,
      timeout: 60,
      trigger: 'API Gateway POST /webhooks/feedly',
      description: 'Process Feedly webhook for article processing',
      dependencies: ['ElectroDB', 'S3', 'yt-dlp-wrap'],
      env: ['TABLE_NAME', 'BUCKET_NAME', 'FEEDLY_TOKEN'],
    },
    FileCoordinator: {
      runtime: 'nodejs22.x',
      memory: 512,
      timeout: 300,
      trigger: 'S3 ObjectCreated event',
      description: 'Orchestrate file processing workflow',
      dependencies: ['ElectroDB', 'Step Functions', 'Lambda'],
      env: ['TABLE_NAME', 'STATE_MACHINE_ARN'],
    },
    DownloadMedia: {
      runtime: 'nodejs22.x',
      memory: 1024,
      timeout: 900,
      trigger: 'Step Functions',
      description: 'Download media from URL using yt-dlp',
      dependencies: ['S3', 'yt-dlp-wrap', 'ytdl-core'],
      env: ['BUCKET_NAME', 'YOUTUBE_COOKIES'],
    },
    CreateThumbnail: {
      runtime: 'nodejs22.x',
      memory: 512,
      timeout: 60,
      trigger: 'Step Functions',
      description: 'Generate thumbnail for media file',
      dependencies: ['S3', 'sharp'],
      env: ['BUCKET_NAME'],
    },
    SendPushNotification: {
      runtime: 'nodejs22.x',
      memory: 256,
      timeout: 30,
      trigger: 'Lambda Invoke',
      description: 'Send APNS push notifications',
      dependencies: ['apns2', 'SNS'],
      env: ['PLATFORM_APPLICATION_ARN', 'APNS_CERT'],
    },
    PruneDevices: {
      runtime: 'nodejs22.x',
      memory: 256,
      timeout: 60,
      trigger: 'CloudWatch Events (daily)',
      description: 'Remove inactive devices',
      dependencies: ['ElectroDB', 'SNS'],
      env: ['TABLE_NAME', 'INACTIVE_DAYS'],
    },
    UserDelete: {
      runtime: 'nodejs22.x',
      memory: 256,
      timeout: 60,
      trigger: 'API Gateway DELETE /users',
      description: 'Delete user and cascade to related entities',
      dependencies: ['ElectroDB', 'S3'],
      env: ['TABLE_NAME', 'BUCKET_NAME'],
    },
  };

  // Lambda triggers mapping
  const triggers = {
    'API Gateway': ['ListFiles', 'LoginUser', 'RegisterDevice', 'StartFileUpload', 'WebhookFeedly', 'UserDelete'],
    'S3 Events': ['FileCoordinator'],
    'Step Functions': ['DownloadMedia', 'CreateThumbnail'],
    'Lambda Invoke': ['SendPushNotification'],
    'CloudWatch Events': ['PruneDevices'],
  };

  // Lambda dependencies summary
  const dependenciesSummary = {
    'AWS Services': {
      'DynamoDB': ['ListFiles', 'LoginUser', 'RegisterDevice', 'StartFileUpload', 'WebhookFeedly', 'FileCoordinator', 'PruneDevices', 'UserDelete'],
      'S3': ['StartFileUpload', 'WebhookFeedly', 'DownloadMedia', 'CreateThumbnail', 'UserDelete'],
      'SNS': ['RegisterDevice', 'SendPushNotification', 'PruneDevices'],
      'Step Functions': ['FileCoordinator'],
      'Lambda': ['FileCoordinator'],
    },
    'Libraries': {
      'ElectroDB': ['ListFiles', 'LoginUser', 'RegisterDevice', 'StartFileUpload', 'WebhookFeedly', 'FileCoordinator', 'PruneDevices', 'UserDelete'],
      'yt-dlp-wrap': ['WebhookFeedly', 'DownloadMedia'],
      'ytdl-core': ['DownloadMedia'],
      'apns2': ['SendPushNotification'],
      'jose': ['LoginUser'],
      'jwks-rsa': ['LoginUser'],
    },
  };

  switch (query) {
    case 'list':
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(Object.keys(lambdaConfigs), null, 2),
          },
        ],
      };

    case 'config':
      if (lambda && lambdaConfigs[lambda as keyof typeof lambdaConfigs]) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(lambdaConfigs[lambda as keyof typeof lambdaConfigs], null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(lambdaConfigs, null, 2),
          },
        ],
      };

    case 'triggers':
      if (lambda) {
        const config = lambdaConfigs[lambda as keyof typeof lambdaConfigs];
        if (config) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ lambda, trigger: config.trigger }, null, 2),
              },
            ],
          };
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(triggers, null, 2),
          },
        ],
      };

    case 'dependencies':
      if (lambda) {
        const config = lambdaConfigs[lambda as keyof typeof lambdaConfigs];
        if (config) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ lambda, dependencies: config.dependencies }, null, 2),
              },
            ],
          };
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(dependenciesSummary, null, 2),
          },
        ],
      };

    case 'env':
      if (lambda) {
        const config = lambdaConfigs[lambda as keyof typeof lambdaConfigs];
        if (config) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ lambda, environment: config.env }, null, 2),
              },
            ],
          };
        }
      }
      const allEnv: Record<string, string[]> = {};
      for (const [name, config] of Object.entries(lambdaConfigs)) {
        allEnv[name] = config.env;
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(allEnv, null, 2),
          },
        ],
      };

    default:
      return {
        content: [
          {
            type: 'text',
            text: `Unknown query type: ${query}. Available: list, config, triggers, dependencies, env`,
          },
        ],
      };
  }
}