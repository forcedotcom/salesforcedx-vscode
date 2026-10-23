// Promise API wrapper for the browser fs polyfill.

const fsPolyfill = require('@salesforce/core/fs');
const fsPromises = fsPolyfill.fs.promises;

// Effect's Node FileSystem adapter includes undefined flag/mode fields in
// writeFile options. memfs rejects those fields instead of applying Node's
// defaults, so normalize the options at the browser fs boundary.
const normalizeWriteFileOptions = options => {
  if (options === null || typeof options !== 'object') return options;
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
};

const writeFile = fsPromises.writeFile.bind(fsPromises);
fsPromises.writeFile = (file, data, options) => writeFile(file, data, normalizeWriteFileOptions(options));

module.exports = fsPromises;
module.exports.default = fsPromises;
module.exports.fs = fsPolyfill.fs;
module.exports.getVirtualFs = fsPolyfill.getVirtualFs;
