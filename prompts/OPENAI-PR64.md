## Main Prompt (for LLMs)

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

## The Task

Convert test files from Mocha to Jest.

Here are two examples:
* Source file: src/lambdas/CompleteFileUpload/src/index.ts
* Mocha test file: src/lambdas/CompleteFileUpload/test/index.test.ts
* Jest test file: src/lambdas/CompleteFileUpload/test/index.jest.ts

* Source file: src/lambdas/ListFiles/src/index.ts
* Mocha test file: src/lambdas/ListFiles/test/index.test.ts
* Jest test file: src/lambdas/ListFiles/test/index.jest.ts

Now, I'd like you to create the next test:
* Source file: src/lambdas/LoginUser/src/index.ts
* Mocha test file: src/lambdas/LoginUser/test/index.test.ts
* Jest test file: src/lambdas/LoginUser/test/index.jest.ts

When writing the test remember to:
* Move the fixtures to the top of the file and use the new import syntax asserting the files are JSON
* Use the `jest.unstable_mockModule` method instead of sinon
* Use the new import syntax for the handler
* Re-write the `expect` statements to use Jest matchers instead of Mocha matchers
* Run the newly-created test to confirm it works
