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
    devtoolModuleFilenameTemplate: `webpack:///salesforcedx-sobjects-faux-generator/[resource-path]`
  },
  // include source maps
  devtool: 'source-map',
  // excluding dependencies from getting bundled
  externals: {
    '@salesforce/core': 'commonjs @salesforce/core',
    vscode: 'commonjs vscode',
    'vscode-nls': 'commonjs vscode-nls',
    mocha: 'mocha'
  },
  // Automatically resolve certain extensions.
  resolve: {
    extensions: ['.ts', '.js', '.json']
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
      }
    ]
  }
};
