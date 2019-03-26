const path = require('path');
const DIST = path.resolve(__dirname);

module.exports = {
  // extensions run in a node context
  target: 'node',

  entry: {
    'out/src/index': './src/index.ts',
    'out/src/cli/index': './src/cli/index.ts',
    'out/src/i18n/index': './src/i18n/index.ts',
    'out/src/output/index': './src/output/index.ts',
    'out/src/predicates/predicate': './src/predicates/predicate.ts',
    'out/src/requestService/index': './src/requestService/index.ts',
    'out/src/types/index': './src/types/index.ts'
  },
  // All bundles go into DIST
  // packaging depends on that and this must always be like it
  output: {
    path: DIST,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate:
      'webpack://[namespace]/[resource-path]?[loaders]'
  },
  // include source maps
  devtool: 'source-map',
  // excluding dependencies from getting bundled
  externals: {
    // vscode: 'commonjs vscode',
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
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};
