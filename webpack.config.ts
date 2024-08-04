import * as path from 'path'
import * as glob from 'glob'
import webpack from 'webpack'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'

const config: webpack.Configuration = {
  mode: 'production',
  entry: glob.sync('./src/lambdas/**/src/index.ts').reduce<Record<string, string>>((acc, filePath) => {
    // parse the filepath to the directory of the lambda
    filePath = './' + filePath
    const functionName = filePath.split(/\//)[3]
    acc[functionName] = './' + filePath
    return acc
  }, {}),
  externals: ['aws-sdk'],
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx']
  },
  output: {
    libraryTarget: 'umd',
    path: path.resolve(__dirname, 'build/lambdas'),
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
        exclude: /node_modules/,
        use: ['babel-loader', 'ts-loader']
      }
    ]
  },
  plugins: [new ForkTsCheckerWebpackPlugin()],
  watch: false
}

export default config
