# YouTube Black

An AWS Serverless project for downloading YouTube videos (via Feedly).

## Background

When [YouTube Premium](https://en.wikipedia.org/wiki/YouTube_Premium) was released I was excited that I could download YouTube videos to my phone for offline use when commuting via the subway ([MUNI](https://www.sfmta.com/)). However, there was a monthly fee of $11.99 that, for me, wasn't justifiable. So, [as an engineer](https://www.linkedin.com/in/lifegames), I decided to use this opportunity to build my own version of YouTube Premium using [AWS Serverless](https://aws.amazon.com/serverless/). I dubbed it YouTube Black.

This repository is the source code, cloud formation template, deployment scripts, and documentation that supports **YouTube Black**.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

```bash
nvm use 8.10
npm install --production
npm run build

# verify the application works locally
npm run test-local-list
npm run test-local-hook

# deploy the cloudformation template and associated code
npm run deploy-node-modules
npm run deploy-cloudformation
```

This will deploy the CloudFormation stack to AWS.

## Implementation



## Installation

* Install the [Node Version Manager](https://github.com/creationix/nvm). This will allow you to download the specific version of NodeJS supported by AWS Lambda (8.10).

```bash
brew install nvm
nvm install 8.10.0
nvm use 8.10.0
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


## PRODUCTION TODOS

* PREREQ: Convert from YAML to JSON, and generate template.yaml file
* PREREQ: Allow variables to be injected in to template.yaml
* TODO: Force API Gateway deploy on each push (https://currentlyunnamed-theclassic.blogspot.com/2018/12/mastering-cloudformation-for-api.html)
* TODO: Send push notification when new file ready
* Swagger documentation
* API Gateway documentation
* Automatic generation of JSON fixtures :mind_blown:

## NICE TODOS

* Reduce dependencies so development + production modules can be stored as a layer
* Use AWS EventBridge for EventSourcing
