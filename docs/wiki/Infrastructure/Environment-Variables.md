# Environment Variables

## Quick Reference
- **When to use**: Configuring Lambda functions via OpenTofu
- **Enforcement**: Required - consistent cross-stack configuration
- **Impact if violated**: MEDIUM - Configuration mismatches, runtime errors

## Overview

Lambda environment variables defined in OpenTofu must match TypeScript type definitions and follow consistent naming patterns across all functions and stacks.

## The Rules

### 1. Use SCREAMING_SNAKE_CASE

All environment variable names use uppercase with underscores.

### 2. Match TypeScript Definitions

OpenTofu variable names must match `types/global.d.ts`.

### 3. Reference Resources, Don't Hard-Code

Use Terraform references for AWS resources.

### 4. Group Related Variables

Organize by concern (AWS, features, external services).

## Examples

### ✅ Correct - Environment Variables in OpenTofu

```hcl
# terraform/LambdaProcessFile.tf

resource "aws_lambda_function" "ProcessFile" {
  function_name = "ProcessFile"
  role         = aws_iam_role.ProcessFileRole.arn
  handler      = "index.handler"
  runtime      = "nodejs22.x"
  
  environment {
    variables = {
      # AWS Configuration
      AWS_REGION     = var.aws_region
      AWS_ACCOUNT_ID = var.aws_account_id
      
      # AWS Resources
      TABLE_NAME     = aws_dynamodb_table.MediaDownloader.name
      BUCKET_NAME    = aws_s3_bucket.MediaFiles.id
      SNS_TOPIC_ARN  = aws_sns_topic.FileProcessingNotifications.arn
      
      # Feature Flags
      ENABLE_XRAY    = "true"
      DRY_RUN        = "false"
      DEBUG          = "false"
      
      # Performance Settings
      MAX_RETRIES    = "3"
      TIMEOUT_MS     = "300000"
      
      # External Services
      API_TOKEN      = data.sops_file.secrets.data["api.token"]
      WEBHOOK_URL    = var.webhook_url
    }
  }
}
```

### ✅ Correct - TypeScript Type Definition

```typescript
// types/global.d.ts

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // AWS Configuration
      AWS_REGION: string
      AWS_ACCOUNT_ID: string
      
      // AWS Resources
      TABLE_NAME: string
      BUCKET_NAME: string
      SNS_TOPIC_ARN: string
      
      // Feature Flags
      ENABLE_XRAY: string
      DRY_RUN: string
      DEBUG: string
      
      // Performance Settings
      MAX_RETRIES: string
      TIMEOUT_MS: string
      
      // External Services
      API_TOKEN: string
      WEBHOOK_URL: string
    }
  }
}

export {}
```

### ✅ Correct - Shared Variables

```hcl
# terraform/locals.tf

locals {
  # Common environment variables for all Lambdas
  common_env_vars = {
    AWS_REGION     = var.aws_region
    TABLE_NAME     = aws_dynamodb_table.MediaDownloader.name
    BUCKET_NAME    = aws_s3_bucket.MediaFiles.id
    ENABLE_XRAY    = "true"
  }
}

# terraform/LambdaProcessFile.tf
resource "aws_lambda_function" "ProcessFile" {
  # ...
  
  environment {
    variables = merge(
      local.common_env_vars,
      {
        # Function-specific variables
        MAX_FILE_SIZE = "1073741824"  # 1GB
      }
    )
  }
}

# terraform/LambdaDownloadVideo.tf
resource "aws_lambda_function" "DownloadVideo" {
  # ...
  
  environment {
    variables = merge(
      local.common_env_vars,
      {
        # Function-specific variables
        YTDLP_BINARY_PATH = "/opt/bin/yt-dlp_linux"
      }
    )
  }
}
```

### ❌ Incorrect - Hard-Coded Values

```hcl
# ❌ WRONG - Hard-coded resource names
environment {
  variables = {
    TABLE_NAME  = "MediaDownloader"  # Hard-coded
    BUCKET_NAME = "my-media-files"   # Hard-coded
  }
}

# ✅ CORRECT - Reference resources
environment {
  variables = {
    TABLE_NAME  = aws_dynamodb_table.MediaDownloader.name
    BUCKET_NAME = aws_s3_bucket.MediaFiles.id
  }
}
```

### ❌ Incorrect - Inconsistent Naming

```hcl
# ❌ WRONG - Mixed casing
environment {
  variables = {
    tableName  = aws_dynamodb_table.MediaDownloader.name  # camelCase
    BucketName = aws_s3_bucket.MediaFiles.id              # PascalCase
    API_TOKEN  = var.api_token                            # UPPER_CASE
  }
}

# ✅ CORRECT - All SCREAMING_SNAKE_CASE
environment {
  variables = {
    TABLE_NAME  = aws_dynamodb_table.MediaDownloader.name
    BUCKET_NAME = aws_s3_bucket.MediaFiles.id
    API_TOKEN   = var.api_token
  }
}
```

### ❌ Incorrect - TypeScript Mismatch

```hcl
# ❌ WRONG - OpenTofu uses TABLE_NAME
environment {
  variables = {
    TABLE_NAME = aws_dynamodb_table.MediaDownloader.name
  }
}

# But TypeScript expects different name
// types/global.d.ts
interface ProcessEnv {
  DynamoDBTableName: string  # Mismatch!
}

# ✅ CORRECT - Names match
environment {
  variables = {
    TABLE_NAME = aws_dynamodb_table.MediaDownloader.name
  }
}

interface ProcessEnv {
  TABLE_NAME: string
}
```

## Variable Categories

### AWS Service Configuration

```hcl
environment {
  variables = {
    AWS_REGION         = var.aws_region
    AWS_ACCOUNT_ID     = var.aws_account_id
    
    # DynamoDB
    TABLE_NAME         = aws_dynamodb_table.MediaDownloader.name
    DYNAMODB_ENDPOINT  = ""  # Override for LocalStack
    
    # S3
    BUCKET_NAME        = aws_s3_bucket.MediaFiles.id
    S3_ENDPOINT        = ""  # Override for LocalStack
    S3_ACCELERATE      = "true"
    
    # SNS
    SNS_TOPIC_ARN      = aws_sns_topic.FileProcessingNotifications.arn
  }
}
```

### Feature Flags

```hcl
environment {
  variables = {
    ENABLE_XRAY        = "true"
    DRY_RUN            = "false"
    DEBUG              = "false"
    LOG_LEVEL          = "info"
  }
}
```

### Performance Settings

```hcl
environment {
  variables = {
    MAX_RETRIES        = "3"
    TIMEOUT_MS         = "300000"
    BATCH_SIZE         = "100"
    MEMORY_SIZE_MB     = "1024"
  }
}
```

### External Services

```hcl
environment {
  variables = {
    # Secrets from SOPS
    API_TOKEN          = data.sops_file.secrets.data["api.token"]
    GITHUB_TOKEN       = data.sops_file.secrets.data["github.token"]
    
    # URLs from variables
    WEBHOOK_URL        = var.webhook_url
    FEEDLY_API_URL     = var.feedly_api_url
  }
}
```

## Secrets Management

```hcl
# Load secrets from SOPS
data "sops_file" "secrets" {
  source_file = "${path.module}/../secrets.enc.yaml"
}

# Use in Lambda
resource "aws_lambda_function" "ProcessFile" {
  # ...
  
  environment {
    variables = {
      # ✅ Secrets from SOPS
      API_TOKEN      = data.sops_file.secrets.data["api.token"]
      GITHUB_TOKEN   = data.sops_file.secrets.data["github.token"]
      
      # ❌ NEVER hard-code secrets
      # API_TOKEN = "sk-1234567890abcdef"
    }
  }
}
```

## Conditional Variables

```hcl
# terraform/variables.tf
variable "environment" {
  type    = string
  default = "prod"
}

variable "enable_xray" {
  type    = bool
  default = true
}

# terraform/LambdaProcessFile.tf
resource "aws_lambda_function" "ProcessFile" {
  # ...
  
  environment {
    variables = {
      ENVIRONMENT    = var.environment
      ENABLE_XRAY    = tostring(var.enable_xray)
      DEBUG          = var.environment == "dev" ? "true" : "false"
      LOG_LEVEL      = var.environment == "prod" ? "info" : "debug"
    }
  }
}
```

## Related Patterns

- [Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md) - TypeScript usage patterns
- [Resource Naming](Resource-Naming.md) - Resource name conventions
- [OpenTofu Patterns](OpenTofu-Patterns.md) - Overall conventions

---

*Use SCREAMING_SNAKE_CASE for environment variables, match TypeScript type definitions, and reference resources instead of hard-coding values.*
