const path = require('path');
const DIST = path.resolve(__dirname);

const getMode = () => {
  const webpackMode = process.env.NODE_ENV || 'development';
  console.log(`Running in ${webpackMode} mode`);
  return webpackMode;
};

module.exports = {
  // extensions run in a node context
  target: 'node',
  mode: getMode(),
  entry: { 'dist/src/index': './src/index.ts' },
  // vsix packaging depends on commonjs2
  output: {
    path: DIST,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: `webpack:///salesforcedx-vscode-soql/[resource-path]`
  },
  // include source maps
  devtool: 'source-map',
  // excluding dependencies from getting bundled
  externals: {
    '@salesforce/core': 'commonjs @salesforce/core',
    '@salesforce/soql-common': 'commonjs @salesforce/soql-common',
    '@salesforce/soql-model': 'commonjs @salesforce/soql-model',
    jsforce: 'commonjs jsforce',
    vscode: 'commonjs vscode',
    'vscode-nls': 'commonjs vscode-nls'
  },
  // Automatically resolve certain extensions.
  resolve: {
    extensions: ['.ts', '.js']
  },
  // pre-process certain file types using loaders
  module: {
    rules: [
      {
        test: /\.tsx?$/,
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