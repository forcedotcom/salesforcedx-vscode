import { build } from 'esbuild';
import { commonConfigNode } from './node.mjs';
import esbuildPluginPino from 'esbuild-plugin-pino';

export const pinoSupport = [esbuildPluginPino({ transports: ['pino-pretty'] })];

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
