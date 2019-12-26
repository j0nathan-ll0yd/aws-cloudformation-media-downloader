module.exports = {
  entry: "cloudformation", // folder with templates
  output: "cloudformation.json", // resulting template file
  verbose: true, // whether or not to display additional details
  silent: false, // whether or not to prevent output from being displayed in stdout
  stack: {
    name: "lifegames-sandbox",
    region: "us-west-2",
    params: {
      Capabilities: ['CAPABILITY_AUTO_EXPAND', 'CAPABILITY_IAM'],
      Parameters: [
        {
          ParameterKey: 'ContentBucket',
          ParameterValue: process.env.DEPLOYMENT_BUCKET
        },
        {
          ParameterKey: 'ContentKey',
          ParameterValue: process.env.S3_KEY_NODE_MODULES_ZIP
        },
        {
          ParameterKey: 'CodeKey',
          ParameterValue: process.env.S3_KEY_SOURCE_CODE_ZIP
        }
      ]
    }
  }
};
