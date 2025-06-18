import { build } from 'esbuild';
import { commonConfigNode } from './node.mjs';
import esbuildPluginPino from 'esbuild-plugin-pino';
import { pluginReplace } from '@espcom/esbuild-plugin-replace';

export const pinoSupport = [
  esbuildPluginPino({ transports: ['pino-pretty'] }),
  pluginReplace([
    {
      filter: /\.js$/,
      includeNodeModules: true,
      // this should match exactly what's in the node_modules/@salesforce/core/lib/logger/logger.js file, not what gets into the bundle
      replace: `'..', '..', 'lib', 'logger', 'transformStream'`,
      replacer: () => `'./transformStream'`
    }
  ])
];

export const bundleTransformStream = () =>
  build({
    ...commonConfigNode,
    entryPoints: ['../../node_modules/@salesforce/core/lib/logger/transformStream.js'],
    outfile: './dist/transformStream.js'
  });

// TODO: maybe we need this stuff from sfdx-core's original bundle code
// // There is a wrong reference after bundling due to a bug from esbuild-plugin-pino. We will replace it with the correct one.
// const searchString = /\$\{process\.cwd\(\)\}\$\{require\("path"\)\.sep\}tmp-lib/g;
// const replacementString = `\${__dirname}\${require("path").sep}`;

// if (!searchString.test(bundledEntryPoint)) {
//   console.error('Error: the reference to be modified is not detected - Please reach out to IDEx Foundations team.');
//   process.exit(1); // Exit with an error code
// }
// bundledEntryPoint = bundledEntryPoint.replace(searchString, replacementString);
// fs.writeFileSync(filePath, bundledEntryPoint, 'utf8');
