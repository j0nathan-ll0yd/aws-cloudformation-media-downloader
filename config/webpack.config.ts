import * as glob from 'glob'
import webpack from 'webpack'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Discover Lambda entry points dynamically
const lambdaEntryFiles = glob.sync('./src/lambdas/**/src/index.ts')
const entry = lambdaEntryFiles.reduce<Record<string, string>>((acc, filePath) => {
  console.log(filePath)
  filePath = './' + filePath
  const functionName = filePath.split(/\//)[3]
  acc[functionName] = './' + filePath
  return acc
}, {})

const config: webpack.Configuration = {
  mode: 'production',
  entry,
  externals: {
    // AWS SDK v3 is available in Lambda runtime - externalize to reduce bundle size
    '@aws-sdk/client-api-gateway': '@aws-sdk/client-api-gateway',
    '@aws-sdk/client-cloudwatch': '@aws-sdk/client-cloudwatch',
    '@aws-sdk/client-dynamodb': '@aws-sdk/client-dynamodb',
    '@aws-sdk/client-lambda': '@aws-sdk/client-lambda',
    '@aws-sdk/client-s3': '@aws-sdk/client-s3',
    '@aws-sdk/client-sns': '@aws-sdk/client-sns',
    '@aws-sdk/client-sqs': '@aws-sdk/client-sqs',
    '@aws-sdk/lib-dynamodb': '@aws-sdk/lib-dynamodb',
    '@aws-sdk/lib-storage': '@aws-sdk/lib-storage',
    '@aws-sdk/util-dynamodb': '@aws-sdk/util-dynamodb'
    // Note: aws-xray-sdk-core is NOT in Lambda runtime - must be bundled
  },
  resolve: {extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']},
  output: {libraryTarget: 'commonjs2', path: path.resolve(__dirname, './../build/lambdas'), filename: '[name].js'},
  optimization: {
    usedExports: true,
    // Disable code splitting - each Lambda must be a single self-contained file
    // The Terraform archive_file resource uses source_file (single file) not source_dir
    splitChunks: false,
    runtimeChunk: false
  },
  stats: {usedExports: true},
  target: 'node',
  module: {
    rules: [
      {
        // Include ts, tsx, js, and jsx files.
        test: /\.(ts|js)x?$/,
        exclude: [/node_modules/, /\.test\.ts$/, /\/test\//],
        use: 'ts-loader'
      }
    ],
    // Force dynamic imports to be eager (included in main bundle, not separate chunks)
    // This prevents dependencies like better-auth/kysely from creating async chunks
    parser: {
      javascript: {
        dynamicImportMode: 'eager'
      }
    }
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({typescript: {configOverwrite: {exclude: ['**/*.test.ts', '**/test/**']}}}),
    // Note: kysely must be bundled - Better Auth requires it at runtime even with custom adapters
    // Limit chunks to match entry count - prevents any async/shared chunks from being created
    // Dynamic computation ensures this stays in sync when adding new Lambdas
    new webpack.optimize.LimitChunkCountPlugin({maxChunks: lambdaEntryFiles.length})
  ],
  watch: false
}

export default config
