import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const emptyPolyfillsPath = join(__dirname, 'empty-polyfills.js');
const processGlobalPath = join(__dirname, 'process-global.js');
const processPolyfillPath = join(__dirname, 'process-polyfill.js');
const bufferGlobalPath = join(__dirname, 'buffer-global.js');
const fsPolyfillPath = join(__dirname, 'fs-polyfill.js');

// Plugin to transform jszip's nodestream check to always return true
const jszipNodestreamTransformPlugin = () => ({
  name: 'jszip-nodestream-transform',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async args => {
      const fs = await import('fs/promises');
      let contents = await fs.readFile(args.path, 'utf8');

      // Only transform if the file contains the jszip nodestream check pattern
      if (contents.includes('nodestream') && contents.includes('readable-stream')) {
        // console.log(`🔧 jszipNodestreamTransformPlugin: Transforming ${args.path}`);
        // Transform the nodestream detection to always return true
        // Replace: r.nodestream = !!e("readable-stream").Readable;
        // With: r.nodestream = true;
        contents = contents
          // Force nodestream to true AND provide proper NodejsStreamOutputAdapter
          .replace(
            /try\{(\w+)\.nodestream=!!\w+\([^)]*\)\.Readable\}catch\([^)]+\)\{\1\.nodestream=![01]\}/g,
            '$1.nodestream=!0'
          )
          .replace(
            // Provide a proper NodejsStreamOutputAdapter that uses readable-stream
            /if\((\w+)\.nodestream\)try\{(\w+)=\w+\([^)]*NodejsStreamOutputAdapter[^)]*\)\}/g,
            `if($1.nodestream)try{
            const {Readable}=require('readable-stream');
            function NodejsStreamOutputAdapter(helper,options,updateCb){
              Readable.call(this,options);
              this._helper=helper;
              var self=this;
              helper.on('data',function(data,meta){
                if(!self.push(data)){self._helper.pause();}
                if(updateCb){updateCb(meta);}
              }).on('error',function(e){self.emit('error',e);})
              .on('end',function(){self.push(null);});
            }
            NodejsStreamOutputAdapter.prototype=Object.create(Readable.prototype);
            NodejsStreamOutputAdapter.prototype.constructor=NodejsStreamOutputAdapter;
            NodejsStreamOutputAdapter.prototype._read=function(){this._helper.resume();};
            $2=NodejsStreamOutputAdapter;
          }`
          );

        return { contents, loader: 'js' };
      }
    });
  }
});

export const commonConfigBrowser = {
  mainFields: ['browser', 'module', 'main'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  external: ['vscode'],
  // TODO: we need a way to turn this off for debugging and local dev
  minify: false,
  sourcemap: true,
  keepNames: true,
  resolveExtensions: ['.js', '.ts', '.json'],
  inject: [processGlobalPath, bufferGlobalPath],
  logOverride: {
    'unsupported-dynamic-import': 'error'
  },
  define: {
    'process.env.SF_DISABLE_LOG_FILE': "'true'",
    'process.env.FORCE_MEMFS': "'true'", // Added this line    // Ensure global is available for Node.js modules
    global: 'globalThis'
    // Other global polyfills
  },
  alias: {
    // proper-lockfile and SDR use graceful-fs
    'graceful-fs': fsPolyfillPath,
    fs: fsPolyfillPath,
    'node:fs': fsPolyfillPath,
    'node:fs/promises': fsPolyfillPath,
    jsonwebtoken: 'jsonwebtoken-esm',
    // Redirect jsforce-node to browser-compatible jsforce.  This is important, it won't auth without it but I don't understand why.
    '@jsforce/jsforce-node': 'jsforce/browser',
    '@jsforce/jsforce-node/lib': 'jsforce/browser',
    // Force use of our custom process polyfill instead of esbuild's built-in
    process: processPolyfillPath,
    // Force all readable-stream imports to use the main one to avoid duplication
    'readable-stream': 'readable-stream',
    events: 'events', // Node.js built-in module polyfills
    'node:path': 'path-browserify',
    'node:http': 'stream-http',
    'node:https': 'https-browserify',
    'node:os': 'os-browserify',
    'node:buffer': 'buffer',
    'node:stream': 'readable-stream',
    'node:util': 'util',
    'node:events': 'events',

    'node:url': '/Users/shane.mclaughlin/eng/forcedotcom/salesforcedx-vscode/scripts/bundling/url-polyfill.js',
    'node:crypto': 'crypto-browserify',
    'node:querystring': 'querystring-es3',
    'node:assert': 'assert',
    'node:path/posix': 'path-browserify',
    'node:assert/strict': 'assert',
    // Polyfills for jsforce-node dependencies
    // Empty polyfills for modules that can't be polyfilled
    'node:child_process': emptyPolyfillsPath,
    'node:dns': emptyPolyfillsPath,
    'node:net': emptyPolyfillsPath,
    'node:tls': emptyPolyfillsPath,
    'node:http2': emptyPolyfillsPath,
    got: emptyPolyfillsPath, // has a lot of very node-focused references in its dependencies.
    // Standard Node.js modules (without node: prefix)
    path: 'path-browserify',
    os: 'os-browserify',
    buffer: 'buffer',
    stream: 'readable-stream',
    util: 'util',
    url: '/Users/shane.mclaughlin/eng/forcedotcom/salesforcedx-vscode/scripts/bundling/url-polyfill.js',
    crypto: 'crypto-browserify',
    http: 'stream-http',
    https: 'https-browserify',
    querystring: 'querystring-es3',
    assert: 'assert',
    zlib: 'browserify-zlib',
    timers: 'timers-browserify'
  },
  plugins: [
    jszipNodestreamTransformPlugin(),
    nodeModulesPolyfillPlugin({
      modules: {
        // Empty polyfills for modules that can't be polyfilled
        child_process: 'empty',
        dns: 'empty',
        net: 'empty',
        tls: 'empty',
        http2: 'empty'
      },
      globals: {
        process: false,
        Buffer: false
      }
    })
  ]
};
