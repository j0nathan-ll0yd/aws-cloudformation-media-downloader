You are an expert programmer. You have been given this project and asked to own it for the foreseeable future. The project is written in TypeScript, hosted on AWS Amazon Web Services (AWS) as a serverless project.

Here are some requirements you need to follow:
* Don't output commands that just list files (like 'ls -l')
* Use the commitlint syntax when structuring commit messages
* Always ignore the `node_modules` directory when searching
* Always ignore the `dist` directory
* Always ignore the `package-lock.json` file when searching, unless your dealing with dependencies

To describe the project for you:
* In the src/lamdbas directory, every subdirectory is a unique lambda. It contains the directories:
  * src - with a file called 'index.ts' that contains the lambdas source code. The functions are documented using TypeDoc.
  * test - with a file called 'index.test.ts' that contains the unit tests for the lambda using mocha
  * test/fixtures - this contains JSON files for mocking objects
* In the lib/vendor directory are wrappers around 3rd party APIs
* In the pipeline directory are tests for the Github Actions runners
* In the types directory are TypeScript types for the project
* In the util directory are common functions, or groups of related functions, used by the lambdas included below. Most have their own tests, which include the same file name, but with 'test.ts' instead of just '.ts'.
  * apigateway-helpers.ts are utility functions for lambdas behind an API Gateway
  * constants.ts are simple constant data structures
  * constraints.ts are constraint configurations for the 'validate.js' module, used for input validation for lambdas
  * dynamodb-helpers.ts are utility functions for using DynamoDB
  * errors.ts are shared error types for the project
  * github-helpers.ts are utility functions for using GitHub
  * lambdas-helpers.ts are utility functions for preparing responses, or logging in a Lambda context
  * mocha-setup.ts prepares the environment for running mocha tests
  * secretsmanager-helpers.ts are utility functions for using AWS SecretsManager
  * shared.ts are custom functions used by multiple lambdas (in the src/lambdas directory)
  * transformers.ts are utility functions for converting one data structure to another
* In the terraform directory are all of the Terraform files used for AWS. Each lambda outlined in this Terraform configuration lives in the 'src/lamdas' directory.

Take a moment to familiarize yourself with the structure of the project. You should also read the package.json file.

Then, read the `graph.json` file. This is a code graph of the project using `ts-morph`. Use it to identify relationships between files.

Here's the project we're going to work on:

We're going to replace the usage of Amazon's SecretManager (`@aws-sdk/client-secrets-manager`) with the 1 Password SDK (`@1password/sdk`). Here is a mapping of the current secrets in SecretsManager to their paths in 1Password:

* GithubPersonalToken = "op://AWS/GithubPersonalToken/credential"
* ApnsSigningKey = "op://AWS/ApnsSigningKey/credential"
* ApplePushNotificationServiceKey = "op://AWS/ApplePushNotificationServiceKey/credential"
* ApplePushNotificationServiceCert = "op://AWS/ApplePushNotificationServiceCert/credential"
* PrivateEncryptionKey = "op://AWS/PrivateEncryptionKey/credential"
* prod/SignInWithApple/Config = "op://AWS/6rocnkruqbz74rdl2gyc2cxe5y/credential"
* prod/SignInWithApple/AuthKey = "op://AWS/3wf2hes3b62foviwmwvedju2s4/credential"

In order to accomplish this, you'll need to:

* Update the `secretsmanager-helper` file and the `getSecretValue` function to use the 1 Password API instead of SecretsManager
  * An example for using the 1 Password SDK is in the `1-password-example.js` file
* Update the associated unit test file `secretsmanager-helpers.test` and ensure it works correctly
* Update the Terraform configuration to remove dependencies on SecretsManager
