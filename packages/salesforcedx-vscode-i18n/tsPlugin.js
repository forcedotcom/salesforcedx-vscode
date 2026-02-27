// Node10-compatible proxy for tsserver plugin resolution.
// tsserver's tryResolveJSModuleWorker hardcodes Node10 resolution,
// which ignores package.json "exports" maps.
module.exports = require('./out/src/hover/tsPlugin');
