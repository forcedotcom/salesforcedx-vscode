/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import webpack from 'webpack';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';

/** @type {import('webpack').Configuration} */
const browserConfig = {
  target: 'webworker',
  mode: 'production',
  entry: {
    browser: './out/src/index.js'
  },
  output: {
    path: path.resolve('dist'),
    filename: 'browser.js',
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    mainFields: ['module', 'main'],
    extensions: ['.ts', '.js'],
    alias: {
      'node:path/posix': 'path-browserify',
      'path/posix': 'path-browserify'
    },
    fallback: {
      tls: false,
      child_process: false,
      dns: false,
      net: false,
      http2: false
    }
  },
  plugins: [
    new webpack.EnvironmentPlugin({ SF_DISABLE_LOG_FILE: 'true' }),
    new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
      resource.request = resource.request.replace(/^node:/, '');
    }),
    new NodePolyfillPlugin({
      additionalAliases: ['process', 'Buffer']
    })
  ],
  optimization: {
    minimize: false,
    usedExports: false
  }
};

export default [browserConfig];
