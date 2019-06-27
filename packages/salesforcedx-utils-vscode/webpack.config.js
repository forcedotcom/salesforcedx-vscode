const path = require('path');
const glob = require('glob');
const DIST = path.resolve(__dirname);

const getEntryObject = () => {
  const entryArray = glob.sync('src/**/*.ts');
  const srcObj = entryArray.reduce((acc, item) => {
    const modulePath = item.replace(/\/[\.A-Za-z_-]*\.ts/g, '');
    const outputModulePath = path.join('out', modulePath, 'index');

    if (!acc.hasOwnProperty(outputModulePath)) {
      // webpack requires the object to be in this format
      // { 'out/src/cli/index': './src/cli/index.ts' }
      acc[outputModulePath] = '.' + path.join(path.sep, modulePath, 'index.ts');
    }

    return acc;
  }, {});

  if (getMode() !== 'development') {
    return srcObj;
  }

  const entryTestArray = glob.sync('test/**/*.ts');
  const testObj = entryTestArray.reduce((acc, item) => {
    const modulePath = item.replace(/\.ts/g, '');
    const outputModulePath = path.join('out', modulePath);

    if (!acc.hasOwnProperty(outputModulePath)) {
      // webpack requires the object to be in this format
      // { 'out/test/unit/cli/commandExecutorTest': './test/unit/cli/commandExecutorTest.ts' }
      acc[outputModulePath] = '.' + path.join(path.sep, `${modulePath}.ts`);
    }

    return acc;
  }, {});

  return Object.assign(testObj, srcObj);
};

const getMode = () => {
  const webpackMode = process.env.NODE_ENV || 'development';
  console.log(`Running in ${webpackMode} mode`);
  return webpackMode;
};

module.exports = {
  // extensions run in a node context
  target: 'node',
  mode: getMode(),
  entry: getEntryObject(),
  // vsix packaging depends on commonjs2
  output: {
    path: DIST,
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: `webpack:///salesforcedx-utils-vscode/[resource-path]`
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
    extensions: ['.ts', '.tsx', '.js']
  },
  // pre-process certain file types using loaders
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules|\.d\.ts$/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  }
};
