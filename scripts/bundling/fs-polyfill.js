// FS polyfill wrapper that provides both named and default exports.
// Used for node:fs and node:fs/promises in web. Also aliased as @salesforce/core/fs in web
// so setFs/getVirtualFs and glob share one fs instance (see docs/setFs-memfs-deep-dive.md).
// Static path so bundlers can resolve it; avoids circular require when @salesforce/core/fs is aliased here.
// Set exports immediately so require() never returns undefined during circular load (core/fs -> node:fs -> polyfill).
const exportsRef = { __esModule: true };
module.exports = exportsRef;

// Lazy load core/fs so that when core/fs requires "node:fs" (this polyfill) during its init, we don't
// read coreFs.getVirtualFs before core has finished exporting it (avoids undefined due to circular require).
let coreFs;
function getCoreFs() {
  if (!coreFs) coreFs = require('../../node_modules/@salesforce/core/lib/fs/fs.js');
  return coreFs;
}

// Live view of coreFs.fs so that after setFs(newFs), glob and other consumers see the new fs.
// If core.fs is not set yet (e.g. during circular init), use getVirtualFs() so we never read from undefined.
const liveView = new Proxy(
  {},
  {
    get(_, prop) {
      const core = getCoreFs();
      const fs = core.fs ?? (typeof core.getVirtualFs === 'function' ? core.getVirtualFs() : undefined);
      if (fs == null) {
        throw new Error('@salesforce/core fs not ready (core.fs and getVirtualFs() are undefined). Ensure setFs(getVirtualFs(volume)) runs during extension activation.');
      }
      return fs[prop];
    }
  }
);

// Own property names we expose so bundler/CJS interop (e.g. getOwnPropertyNames) sees them.
// 'fs' must be listed so consumers (e.g. memfsWatcher) get a defined export; otherwise bundler can treat .fs as undefined.
const OWN_KEYS = ['fs', 'setFs', 'getVirtualFs'];

// Single export: Proxy so (1) all reads delegate to liveView/setFs/getVirtualFs, and (2) getOwnPropertyDescriptor/ownKeys
// expose setFs, getVirtualFs, and fs as own enumerable properties so esbuild's require() interop finds them.
const exportProxy = new Proxy(liveView, {
  get(target, prop) {
    // If the target already has this property (e.g. set by bundler CJS interop), return it to satisfy Proxy invariant.
    if (prop === 'setFs' || prop === 'getVirtualFs') {
      if (Reflect.has(target, prop)) return Reflect.get(target, prop);
      return getCoreFs()[prop];
    }
    if (prop === '__esModule') return true;
    if (prop === 'default') return exportProxy;
    if (prop === 'fs') return target; // liveView delegates to core.fs; same object for all fs methods
    return target[prop];
  },
  getOwnPropertyDescriptor(_, prop) {
    // Always return configurable so the engine never treats these as invariant-bound; we supply the value in get().
    if (prop === 'setFs' || prop === 'getVirtualFs') {
      return { enumerable: true, configurable: true, writable: true, value: getCoreFs()[prop] };
    }
    if (prop === 'fs') {
      return { enumerable: true, configurable: true, writable: true, value: liveView };
    }
    if (prop === '__esModule') {
      return { enumerable: true, configurable: true, writable: true, value: true };
    }
    if (prop === 'default') {
      return { enumerable: true, configurable: true, writable: true, value: exportProxy };
    }
    return Object.getOwnPropertyDescriptor(liveView, prop);
  },
  ownKeys() {
    return ['__esModule', 'default', ...OWN_KEYS, ...Reflect.ownKeys(liveView)];
  }
});

module.exports = exportProxy;
module.exports.__esModule = true;
module.exports.default = exportProxy;
// Do NOT assign module.exports.setFs/getVirtualFs: the Proxy get trap returns them, and
// assigning would set them on the target and violate the "must return actual value" invariant.

// Eagerly init core/fs so exports.fs is set (default memfs) before any consumer runs; setFs() will replace it during activation.
getCoreFs();
