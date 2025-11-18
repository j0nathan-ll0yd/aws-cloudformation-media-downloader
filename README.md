# Media Downloader

A media downloader designed to integrate with [it's companion iOS App](https://github.com/j0nathan-ll0yd/ios-OfflineMediaDownloader). It is [serverless](https://aws.amazon.com/serverless/), deployed with [Terraform](https://www.terraform.io/), and built with [TypeScript](https://www.typescriptlang.org/).

## Architecture

View the [AWS Architecture Diagram](https://gitdiagram.com/repo/j0nathan-ll0yd/aws-cloudformation-media-downloader) (via GitDiagram)

## Background

When [YouTube Premium](https://en.wikipedia.org/wiki/YouTube_Premium) was released they announced "exclusive original content, access to audio-only versions of videos and offline playback on your mobile device." I wasn't interested in the content, but I was excited about offline playback due to poor connectivity when commuting via the [MUNI](https://www.sfmta.com/). _Buuuuuuut_, there was a monthly fee of $11.99.

So, [as an engineer](https://www.linkedin.com/in/lifegames), I used this opportunity to build my own media downloader service, experiment with the latest AWS features, along with a [companion iOS App](https://github.com/j0nathan-ll0yd/ios-OfflineMediaDownloader) using SwiftUI and Combine.

The end result is a generic backend infrastructure that could support any number of features or Apps. This repository is the source code, Terraform templates, deployment scripts, documentation and tests that power the App's backend. This includes:

* The ability to download videos and have them stored to an S3 bucket.
* The ability to view downloaded videos (via API).
* The ability to register for and dispatch push notifications to the mobile App.
* It also has a custom authorizer Lambda function that supports query-based API tokens. This was needed for integration with Feedly.

I share this for any engineer to be able to build a basic backend and iOS App for a future pet project.

## Project Tenants

* The costs per month should be less than $12.
* Minimize external dependencies.
* [Convention over configuration](https://en.wikipedia.org/wiki/Convention_over_configuration). Minimize code, leverage AWS services.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

```bash
# Ensure the correct version of NodeJS (via NVM)
nvm use lts/jod

# Install dependencies
npm install

# Build the AWS Lambda functions (using webpack)
npm run build

# Run the tests to ensure everything is working
npm run test

# Use Terraform to deploy the infrastructure
cd terraform
terraform init
terraform apply

# Once complete, verify the application works remotely
npm run test-remote-list
npm run test-remote-hook
```

## Quick Start

```bash
# Install system dependencies and configure
brew install act awscli jq nvm quicktype terraform terraform-docs
nvm install lts/jod
nvm use lts/jod
aws configure

# Install Node dependencies and deploy project
npm install
npm run build-dependencies
npm run build
npm run test
npm run deploy

# Confirm everything is working as expected
npm run test-remote-list
```


## Installation

* Install the [Node Version Manager](https://github.com/creationix/nvm). This will allow you to download the specific version of NodeJS supported by AWS Lambda (8.10).

```bash
brew install nvm
nvm install lts/jod
nvm use lts/jod
```

* Install the [Official Amazon AWS command-line interface](https://aws.amazon.com/cli/). [Configure](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) for your AWS account.

```bash
brew install awscli
aws configure
```

* Install [terraform](https://www.terraform.io/) (used for deployment scripts)

```bash
brew install terraform
```

* Install [sops](https://github.com/getsops/sops) (used for secret management)

```bash
brew install sops age

# Generate a local encryption key (AGE format - modern and simple)
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt

# Get the public key for SOPS config
PUBLIC_KEY=$(age-keygen -y ~/.config/sops/age/keys.txt)
echo "Your public key: $PUBLIC_KEY"

# Create SOPS config in your project root
cat > .sops.yaml << EOF
creation_rules:
  # YAML and JSON files
  - path_regex: secrets\.yaml
    age: $PUBLIC_KEY
EOF

# Create secrets.yaml template
cat > secrets.yaml << 'EOF'
signInWithApple:
  config: >
    {"client_id":"your.bundle.id","team_id":"YOUR_TEAM_ID","redirect_uri":"","key_id":"YOUR_KEY_ID","scope":"email name"}
  authKey: |
    -----BEGIN PRIVATE KEY-----
    YOUR_SIGN_IN_WITH_APPLE_PRIVATE_KEY_HERE
    -----END PRIVATE KEY-----

apns:
  staging:
    team: YOUR_TEAM_ID
    keyId: YOUR_APNS_KEY_ID
    defaultTopic: your.bundle.id
    host: 'api.sandbox.push.apple.com'
    signingKey: |
      -----BEGIN PRIVATE KEY-----
      YOUR_APNS_SIGNING_KEY_HERE
      -----END PRIVATE KEY-----
    privateKey: |
      -----BEGIN PRIVATE KEY-----
      YOUR_APNS_PRIVATE_KEY_HERE
      -----END PRIVATE KEY-----
    certificate: |
      -----BEGIN CERTIFICATE-----
      YOUR_APNS_CERTIFICATE_HERE
      -----END CERTIFICATE-----

github:
  issue:
    token: YOUR_GITHUB_PERSONAL_ACCESS_TOKEN

platform:
  key: 'YOUR_RANDOM_ENCRYPTION_KEY_HERE'
EOF

echo "Setup complete! Your private key is in ~/.config/sops/age/keys.txt"
echo "Public key added to .sops.yaml"
echo "Created secrets.yaml template - update with your actual values"
echo "Keep your private key secure and share the public key with team members"

# Encrypt secrets (after updating with real values)
# sops --encrypt --output secrets.yaml.encrypted secrets.yaml
```

* Install [quicktype](https://quicktype.io/) (used for generating TypeScript types from Terraform)

```bash
brew install quicktype
```

* Install [terraform-docs](https://github.com/terraform-docs/terraform-docs) (used for Terraform documentation)

```bash
brew install terraform-docs
```

* Install [jq](https://stedolan.github.io/jq/) (used for JSON parsing)

```bash
brew install jq
```

* Install [act](https://github.com/nektos/act) (used for running Github Actions locally)

```bash
brew install act
```

You will also need to create an environment variable called `GITHUB_TOKEN` with [a personal access token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token) from Github.

* Install [gh](https://www.terraform.io/) (for Github usage by Claude Code)

```bash
brew install gh
```

## Configuring Push Notifications

In order for this project to work out-of-the-box, you will need to do some additional configuration in order to support push notifications. This includes generating a certificate to use the Apple Push Notification Service (APNS) and a subsequent p12 file. Instructions can be found [here](https://calvium.com/how-to-make-a-p12-file/).

Once created, you will extract the certificate and the private key in to separate files and move them in to the `secure/APNS_SANDBOX` directory at the root of the project:

```bash
# Extract the private key
openssl pkcs12 -in certificate.p12 -nodes -nocerts -legacy | sed -ne '/-BEGIN PRIVATE KEY-/,/-END PRIVATE KEY-/p' > privateKey.txt

# Extract the certificate file
openssl pkcs12 -in certificate.p12 -clcerts -nokeys -legacy  | sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' > certificate.txt

# Create the directories
mkdir -p secure/APNS_SANDBOX

# Move the files in to the directory
mv privateKey.txt certificate.txt secure/APNS_SANDBOX
```

Once complete, run `terraform apply` and a new platform application will be created so you can register your device to receive push notifications.

## Configuring Github Issue Creation

As an engineer, I appreciate actionable alerting. If something went wrong, I'd like to be able to know about it, have the relevant data to address the situation, and then mark it as completed. To do this, errors that are correctable will be automatically submitted as Github issues to the repository. To support this functionality, you need to generate a [Github Personal Token](https://github.com/settings/tokens?type=beta) that has access to creating issues.

Once generated, store it as `githubPersonalToken.txt` in the `secure` directory so that it isn't tracked by version control.

## Deployment

* Deploy Code - To deploy code changes only, this command will build the distribution files and trigger a terraform **auto approval**.

```bash
npm run build
npm run deploy
```

### Production Testing

In order to test your endpoint in production, you can use the npm commands below.

Remotely test the listing of files

```bash
npm run test-remote-list
```

Remotely test the feedly webhook

```bash
npm run test-remote-hook
```

Remotely test the register device method for registering for push notifications on iOS

```bash
npm run test-remote-registerDevice
```

### Integration Testing with LocalStack

This project includes integration tests that run against [LocalStack](https://localstack.cloud/), a local AWS cloud emulator. Integration tests verify that AWS service interactions work correctly without mocking, providing higher confidence in production deployments.

#### Prerequisites

- **Docker**: Required to run LocalStack container
- **docker-compose**: Used to manage LocalStack lifecycle
- **jq**: Optional, for pretty-printing health check results

```bash
brew install docker docker-compose jq
```

#### Running Integration Tests

**Quick Start:**

```bash
# Start LocalStack
npm run localstack:start

# Run integration tests
npm run test:integration:full

# Stop LocalStack when done
npm run localstack:stop
```

**Available Commands:**

- `npm run localstack:start` - Start LocalStack container in detached mode
- `npm run localstack:stop` - Stop and remove LocalStack container
- `npm run localstack:logs` - Stream LocalStack logs
- `npm run localstack:health` - Check LocalStack service health
- `npm run test:integration` - Run integration tests (assumes LocalStack is running)
- `npm run test:integration:full` - Full integration test suite with LocalStack lifecycle management

**Test Organization:**

Integration tests are located in `test/integration/` and organized by AWS service:

```
test/integration/
├── s3/                   # S3 integration tests
├── dynamodb/             # DynamoDB integration tests
├── lambda/               # Lambda integration tests
├── sns/                  # SNS integration tests
├── sqs/                  # SQS integration tests
├── cloudwatch/           # CloudWatch integration tests
└── apigateway/           # API Gateway integration tests
```

**LocalStack Configuration:**

LocalStack runs on `http://localhost:4566` and provides the following AWS services:

- S3 (Simple Storage Service)
- DynamoDB (NoSQL Database)
- SNS (Simple Notification Service)
- SQS (Simple Queue Service)
- Lambda (Serverless Functions)
- CloudWatch (Monitoring)
- API Gateway (REST APIs)

**Architecture:**

Integration tests use the same vendor wrappers (`src/lib/vendor/AWS/*`) as production code. When `USE_LOCALSTACK=true` environment variable is set, the vendor wrappers automatically configure AWS SDK clients to connect to LocalStack instead of production AWS.

See `test/integration/README.md` for detailed integration testing documentation.

## Documentation

This project uses multiple documentation approaches:

### API Documentation with TypeSpec

The API is documented using [TypeSpec](https://typespec.io/), a language for defining APIs that generates OpenAPI specifications. To generate and view API documentation:

```bash
npm run document-api
```

This command will:
1. Automatically discover and sync API fixtures (`apiRequest-*.json` and `apiResponse-*.json`) from lambda test directories
2. Compile TypeSpec definitions to OpenAPI 3.0 specification (`docs/api/openapi.yaml`)
3. Generate a Redoc HTML documentation file (`docs/api/index.html`)
4. Automatically open the documentation in your default browser

You can also view the documentation by opening `docs/api/index.html` directly in any browser.

See `tsp/README.md` for more details about the TypeSpec definitions.

### Source Code Documentation with TSDoc

This project uses [TSDoc](https://tsdoc.org) for documenting the source code. To generate this documentation:

```bash
npm run document-source
```

The resulting output is located in `docs/source` and can open viewed by running:

```bash
open docs/source/index.html
```

### TODOS

* Update Terraform
  * Better handle conditional variables (like Github Personal Token)

* Update Unit Tests
  * Write a test case for the absence of a Github Personal Token
