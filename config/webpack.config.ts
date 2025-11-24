import * as glob from 'glob'
import webpack from 'webpack'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const config: webpack.Configuration = {
  mode: 'production',
  entry: glob.sync('./src/lambdas/**/src/index.ts').reduce<Record<string, string>>((acc, filePath) => {
    // parse the filepath to the directory of the lambda
    console.log(filePath)
    filePath = './' + filePath
    const functionName = filePath.split(/\//)[3]
    acc[functionName] = './' + filePath
    return acc
  }, {}),
  externals: {
    '@aws-sdk/client-api-gateway': '@aws-sdk/client-api-gateway',
    '@aws-sdk/client-cloudwatch': '@aws-sdk/client-cloudwatch',
    '@aws-sdk/client-dynamodb': '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-lambda': '@aws-sdk/client-lambda',
    '@aws-sdk/client-s3': '@aws-sdk/client-s3',
    '@aws-sdk/client-secrets-manager': '@aws-sdk/client-secrets-manager',
    '@aws-sdk/client-sfn': '@aws-sdk/client-sfn',
    '@aws-sdk/client-sns': '@aws-sdk/client-sns',
    '@aws-sdk/client-sqs': '@aws-sdk/client-sqs',
    '@aws-sdk/lib-dynamodb': '@aws-sdk/lib-dynamodb',
    '@aws-sdk/lib-storage': '@aws-sdk/lib-storage',
    '@aws-sdk/util-dynamodb': '@aws-sdk/util-dynamodb',
    'aws-xray-sdk-core': 'aws-xray-sdk-core',
    'supports-color': 'supports-color'
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']
  },
  output: {
    libraryTarget: 'umd',
    path: path.resolve(__dirname, './../build/lambdas'),
    filename: '[name].js'
  },
  optimization: {
    usedExports: true
  },
  stats: {
    usedExports: true
  },
  target: 'node',
  module: {
    rules: [
      {
        // Include ts, tsx, js, and jsx files.
        test: /\.(ts|js)x?$/,
        exclude: [/node_modules/, /\.test\.ts$/, /\/test\//],
        use: 'ts-loader'
      }
    ]
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configOverwrite: {
          exclude: ['**/*.test.ts', '**/test/**']
        }
      }
    })
  ],
  watch: false
}

export default config
