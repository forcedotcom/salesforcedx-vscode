// TTY polyfill for browser environment
// Provides isatty function that checks if a file descriptor is a TTY
// In browser, this always returns false since there are no TTYs

// isatty function - checks if a file descriptor is a TTY
// In browser, always returns false
const isatty = (fd) => {
  // In browser, there are no TTYs, so always return false
  return false;
};

// Export isatty as both named and default export
module.exports = {
  isatty
};
module.exports.isatty = isatty;
module.exports.default = isatty;
