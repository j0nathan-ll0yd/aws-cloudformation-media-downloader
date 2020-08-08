# Media Downloader

A media downloader designed to integrate with [it's companion iOS App](https://github.com/j0nathan-ll0yd/ios-OfflineMediaDownloader). It is [serverless](https://aws.amazon.com/serverless/), deployed with [AWS CloudFormation](https://aws.amazon.com/cloudformation/), and built with [TypeScript](https://www.typescriptlang.org/).

## Background

When [YouTube Premium](https://en.wikipedia.org/wiki/YouTube_Premium) was released they announced "exclusive original content, access to audio-only versions of videos and offline playback on your mobile device." I wasn't interested in the content, but I was excited about offline playback due to poor connectivity when commuting via the [MUNI](https://www.sfmta.com/). _Buuuuuuut_, there was a monthly fee of $11.99.

So, [as an engineer](https://www.linkedin.com/in/lifegames), I used this opportunity to build my own media downloader service, experiment with the latest AWS features, along with a [companion iOS App](https://github.com/j0nathan-ll0yd/ios-OfflineMediaDownloader) using SwiftUI and Combine.

The end result is a generic backend infrastructure that could support any number of features or Apps. This repository is the source code, CloudFormation templates, deployment scripts, documentation and tests that power the App's backend. This includes:

* The ability to download videos and have them stored to an S3 bucket.
* The ability to view downloaded videos (via API).
* The ability to register for and dispatch push notifications to the mobile App.
* It also has a custom authorizer Lambda function that supports query-based API tokens. This was needed for integration with Feedly.

I share this for any engineer to be able to build a basic backend and iOS App for a future pet project or idea.

## Project Tenants

* The costs per month should be less than $12.
* Minimize external dependencies.
* [Convention over configuration](https://en.wikipedia.org/wiki/Convention_over_configuration). Minimize code, leverage AWS services.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

```bash
# Ensure the correct version of NodeJS (via NVM)
nvm use lts/erbium

# Install dependencies
npm install

# Run the tests to ensure everything is working
npm run test

# Use Terraform to deploy the infrastructure
cd terraform
terraform init
terraform apply

# Verify the application works locally
npm run test-local-list
npm run test-local-hook
```

## Installation

* Install the [Node Version Manager](https://github.com/creationix/nvm). This will allow you to download the specific version of NodeJS supported by AWS Lambda (8.10).

```bash
brew install nvm
nvm install lts/erbium
nvm use lts/erbium
```

* Install the [Official Amazon AWS command-line interface](https://aws.amazon.com/cli/). [Configure](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) for your AWS account.

```bash
brew install awscli
aws configure
```

* Install [jq](https://stedolan.github.io/jq/) (used for deployment scripts)

```bash
brew install jq
```
* Install [terraform](https://www.terraform.io/) (used for deployment scripts)

```bash
brew install terraform
```

## Configuring Push Notifications

In order for this project to work out-of-the-box, you will need to do some additional configuration in order to support push notifications. This includes generating a certificate to use the Apple Push Notification Service (APNS) and a subsequent p12 file. Instructions can be found [here](https://calvium.com/how-to-make-a-p12-file/).

Once created, you will extract the certificate and the private key in to separate files and move them in to the `secure/APNS_SANDBOX` directory at the root of the project:

```bash
# Extract the private key
openssl pkcs12 -in certificate.p12 -nodes -nocerts | sed -ne '/-BEGIN PRIVATE KEY-/,/-END PRIVATE KEY-/p' > privateKey.txt

# Extract the certificate file
openssl pkcs12 -in certificate.p12 -clcerts -nokeys | sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' > certificate.txt

# Create the directories
mkdir -p secure/APNS_SANDBOX

# Move the files in to the directory
mv privateKey.txt certificate.txt secure/APNS_SANDBOX
```

Once complete, run `terraform apply` and a new platform application will be created so you can register your device to receive push notifications.

## Deployment

* Deploy Code - To deploy code changes only, this command will package the distribution files and trigger a terraform apply.

```bash
npm run deploy-code
```

* Deploy `node_modules` - If you changed your package dependencies, run this command to update the Lambda layer.

```bash
npm run deploy-node-modules
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
