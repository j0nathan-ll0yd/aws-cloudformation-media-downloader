# YouTube Black

An AWS Serverless project for downloading YouTube videos (via Feedly).

## Background

When [YouTube Premium](https://en.wikipedia.org/wiki/YouTube_Premium) was released I was excited that I could download YouTube videos to my phone for offline use when commuting via the subway ([MUNI](https://www.sfmta.com/)). However, there was a monthly fee of $11.99 that, for me, wasn't justifiable. So, [as an engineer](https://www.linkedin.com/in/lifegames), I decided to use this opportunity to build my own version of YouTube Premium using [AWS Serverless](https://aws.amazon.com/serverless/). I dubbed it YouTube Black.

This repository is the source code, cloud formation template, deployment scripts, and documentation that supports **YouTube Black**.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

```bash
nvm use 10.16.3
npm install --prod=only
npm run build

# deploy the cloudformation template and associated code
npm run deploy-node-modules
npm run deploy-cloudformation

# verify the application works locally
npm run test-local-list
npm run test-local-hook
```

This will deploy the CloudFormation stack to AWS.

## Implementation



## Installation

* Install the [Node Version Manager](https://github.com/creationix/nvm). This will allow you to download the specific version of NodeJS supported by AWS Lambda (8.10).

```bash
brew install nvm
nvm install 10.16.3
nvm use 10.16.3
```

* Install the [Official Amazon AWS command-line interface](https://aws.amazon.com/cli/). [Configure](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) for your AWS account.

```bash
brew install awscli
aws configure
```

* Install [AWS Serverless Application Model (SAM)](https://github.com/awslabs/aws-sam-cli/). This is for developing on your local environment.

```bash
brew tap aws/tap
brew install aws-sam-cli
```
* Install [jq](https://stedolan.github.io/jq/) (used for deployment scripts)

```bash
brew install jq
```
* Install [md5sha1sum](http://microbrew.org/tools/md5sha1sum/) (used for deployment scripts)

```bash
brew install md5sha1sum
```
* Install [yq](https://mikefarah.github.io/yq/) (used for deployment scripts)

```bash
brew install yq
```

## Deployment

* Deploy CloudFormation - This will deploy your entire CloudFormation template, including your `node_modules` and latest Lambda function code.

```bash
npm run deploy-cloudformation
```

* Deploy Lambda - If there are no changes to your CloudFormation template, you can deploy just your latest source code to your stack.

```bash
npm run deploy-code
```

* Deploy `node_modules` - If changes are made to your package dependencies, you can upload your `node_modules` and update all associated lambda functions.

```bash
npm run deploy-node-modules
```
## Local Testing

Locally test the listing of files

```bash
npm run test-local-list
```

Locally test the feedly webhook

```bash
npm run test-local-hook
```

### Live Testing

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

## PRODUCTION TODOS

* In-Progress: API documentation
** Rename files/assets
** Cleanup cloudformation templates
* TODO: Send push notification when new file is ready
* TODO: Add lambda alarms in case errors are experienced

## NICE TODOS

* Service Maps
* CloudWatch Alarm that posts an issue to Github
* Automatic generation of JSON fixtures :mind_blown:
* Use AWS EventBridge for EventSourcing
