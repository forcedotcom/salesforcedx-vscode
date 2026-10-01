// Set up global Buffer variable for browser environment
const buffer = require('buffer');

// Make Buffer available globally
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = buffer.Buffer;
} else if (typeof window !== 'undefined') {
  window.Buffer = buffer.Buffer;
} else if (typeof global !== 'undefined') {
  global.Buffer = buffer.Buffer;
}

module.exports = buffer;
