// Set up global process variable for browser environment
const processPolyfill = require('./process-polyfill.js');

// Make process available globally
if (typeof globalThis !== 'undefined') {
  globalThis.process = processPolyfill;
} else if (typeof window !== 'undefined') {
  window.process = processPolyfill;
} else if (typeof global !== 'undefined') {
  global.process = processPolyfill;
}

module.exports = processPolyfill;
