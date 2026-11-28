// FS polyfill wrapper that provides both named and default exports
// This is needed because some packages import graceful-fs with __importDefault3

// core/fs itself imports node:fs, which is aliased back here in browser bundles.
// Resolve lazily: eagerly copying .fs can read an uninitialized circular export or pin a superseded backend.
module.exports = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === '__esModule') return false;
      const coreFs = require('@salesforce/core/fs');
      if (property === 'fs') return coreFs.fs;
      if (property === 'getVirtualFs') return coreFs.getVirtualFs;
      return coreFs.fs?.[property];
    },
    ownKeys() {
      const { fs } = require('@salesforce/core/fs');
      return fs ? [...new Set([...Reflect.ownKeys(fs), 'fs', 'getVirtualFs'])] : ['fs', 'getVirtualFs'];
    },
    getOwnPropertyDescriptor(_target, property) {
      return { configurable: true, enumerable: true, value: module.exports[property] };
    }
  }
);
