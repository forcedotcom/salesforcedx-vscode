// FS polyfill wrapper that provides both named and default exports
// This is needed because some packages import graceful-fs with __importDefault3

const fsPolyfill = require('@salesforce/core/fs');
const fs = fsPolyfill.fs;

// Effect's Node FileSystem adapter includes undefined flag/mode fields in
// writeFile options. memfs rejects those fields instead of applying Node's
// defaults, so normalize the options at the browser fs boundary.
const normalizeWriteFileOptions = options => {
  if (options === null || typeof options !== 'object') return options;
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
};

const writeFile = fs.writeFile.bind(fs);
fs.writeFile = (file, data, options, callback) => {
  if (typeof options === 'function') return writeFile(file, data, options);
  const normalizedOptions = normalizeWriteFileOptions(options);
  if (typeof callback === 'function') return writeFile(file, data, normalizedOptions, callback);
  return writeFile(file, data, normalizedOptions, callback);
};

const writeFileSync = fs.writeFileSync.bind(fs);
fs.writeFileSync = (file, data, options) => writeFileSync(file, data, normalizeWriteFileOptions(options));

const writeFilePromise = fs.promises.writeFile.bind(fs.promises);
fs.promises.writeFile = (file, data, options) => writeFilePromise(file, data, normalizeWriteFileOptions(options));

// Export the fs polyfill as both named and default exports
module.exports = fs;
module.exports.fs = fs;
module.exports.getVirtualFs = fsPolyfill.getVirtualFs;
