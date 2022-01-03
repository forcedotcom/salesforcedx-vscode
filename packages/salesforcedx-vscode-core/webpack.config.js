const path = require('path');
const DIST = path.resolve(__dirname);

const getMode = () => {
  const webpackMode = process.env.NODE_ENV || 'development';
  console.log(`Running in ${webpackMode} mode`);
  return webpackMode;
};

module.exports = {
  // silence the output except for errors
  stats: 'minimal',
  // extensions run in a node context
  target: 'node',
  mode: getMode(),
  entry: { 'dist/src/index': './src/index.ts' },
  // vsix packaging depends on commonjs2
  output: {
    path: DIST,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: `webpack:///salesforcedx-vscode-core/[resource-path]`
  },
  // include source maps
  // devtool: 'none',
  // excluding dependencies from getting bundled
  externals: {
    vscode: 'commonjs vscode',
    'vscode-nls': 'commonjs vscode-nls',
    'keybase-ecurve': 'commonjs keybase-ecurve',
    'spdx-expression-parse': 'commonjs spdx-expression-parse',
    'node-gyp': 'commonjs node-gyp',
    'spdx-correct': 'commonjs spdx-correct',
    'gh-got': 'commonjs gh-got',
    'node-gyp': 'commonjs node-gyp',
    'errlop': 'commonjs errlop',
    'download-stats': 'commonjs download-stats'
  },
  // Automatically resolve certain extensions.
  resolve: {
    extensions: ['.ts', '.js']
  },
  // pre-process certain file types using loaders
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [
          /node_modules|\.test.ts$|\.d\.ts$/,
          path.resolve(__dirname, './test')
        ],
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [ 
          {
            loader: 'babel-loader'
          }
        ]
      },
      {
        test: /\.(js\.map)$|\.d\.ts$|\.cs$/,
        use: [
          {
            loader: 'file?name=[name].[ext]'
          }
        ]
      }
    ]
  }
};
