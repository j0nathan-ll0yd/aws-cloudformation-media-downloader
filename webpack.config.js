const glob = require('glob')
const path = require('path')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

module.exports = {
  mode: 'production',
  entry: glob.sync('./src/lambdas/**/src/index.ts').reduce((acc, filePath) => {
    // parse the filepath to the directory of the lambda
    const functionName = filePath.split(/\//)[3]
    acc[functionName] = filePath
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
    usedExports: true,
  },
  stats: {
    usedExports: true,
  },
  target: 'node',
  module: {
    rules: [
      {
        // Include ts, tsx, js, and jsx files.
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        use: [
          'babel-loader',
          'ts-loader'
        ]
      }
    ]
  },
  plugins: [new ForkTsCheckerWebpackPlugin()],
  watch: false
}
