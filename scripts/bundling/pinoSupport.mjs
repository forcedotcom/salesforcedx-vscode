import copy from 'esbuild-plugin-copy';

// this is temporarily grabbing from the core-bundle but we'll elimintate that once everything bundles at real-time.
// as other packages move to the new bundling process, this probably needs to move to a shared location
export const pinoSupport = [
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/transformStream.js'],
      to: ['./transformStream.js']
    }
  }),
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/thread-stream-worker.js'],
      to: ['./thread-stream-worker.js']
    }
  }),
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/pino-pretty.js'],
      to: ['./pino-pretty.js']
    }
  }),
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/pino-worker.js'],
      to: ['./pino-worker.js']
    }
  }),
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/pino-file.js'],
      to: ['./pino-file.js']
    }
  })
];
