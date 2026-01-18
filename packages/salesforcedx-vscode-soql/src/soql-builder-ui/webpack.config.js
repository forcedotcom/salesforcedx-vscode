const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
module.exports = {
  output: {
    filename: 'app.js'
  },
  resolve: {
    fallback: {
      fs: false
    },
    alias: {
      os: 'os-browserify/browser'
    }
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
