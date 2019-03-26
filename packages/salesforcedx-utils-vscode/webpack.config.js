const path = require('path');
const glob = require('glob');
const DIST = path.resolve(__dirname);

const entryArray = glob.sync('src/**/*.ts');
console.log('------------ entryArray = ', entryArray);
const entryObject = entryArray.reduce((acc, item) => {
  const name = item.replace(/\/[\.A-Za-z_-]*\.ts/g, '');
  console.log('name == ', name);
  acc[name] = item;
  return acc;
}, {});
console.log('------------ entryObject = ', entryObject);
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
    'out/src/types/index': './src/types/index.ts',
    'out/test/unit/cli': './test/unit/cli/*.ts'
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
        exclude: ['/node_modules/'],
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};
