const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');
module.exports = {
  output: {
    filename: 'app.js'
  },
  resolve: {
    fallback: {
      fs: false
    },
    alias: {
      os: 'os-browserify/browser',
      '@salesforce/soql-model': path.resolve(__dirname, '../soql-model')
    },
    modules: [
      'node_modules',
      path.resolve(__dirname, '../../../../node_modules')
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      util: 'util/',
      assert: 'assert/'
    })
  ],
  optimization: {
    // this removes license.txt from the output bundle
    minimizer: [
      new TerserPlugin({
        extractComments: false
      })
    ]
  }
};
