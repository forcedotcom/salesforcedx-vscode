// FS polyfill wrapper that provides both named and default exports
// This is needed because some packages import graceful-fs with __importDefault3

const fsPolyfill = require('@salesforce/core/fs');
const path = require('path-browserify');

// Export the fs polyfill as both named and default exports
module.exports = fsPolyfill.fs;
module.exports.fs = fsPolyfill.fs;
module.exports.getVirtualFs = fsPolyfill.getVirtualFs;
module.exports.setFs = fsPolyfill.setFs;
module.exports.resetFs = fsPolyfill.resetFs;
