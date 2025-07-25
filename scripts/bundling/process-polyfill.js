// Minimal process polyfill for browser environment
// Covers the essential Node.js process APIs used in the codebase

// Environment variables - use an empty object for browser
const env = {};

// High-resolution time measurement
const hrtime = time => {
  const now = performance.now();
  if (time) {
    const diff = now - time[0] * 1000 - time[1] / 1000000;
    return [Math.floor(diff / 1000), Math.floor((diff % 1000) * 1000000)];
  }
  return [Math.floor(now / 1000), Math.floor((now % 1000) * 1000000)];
};

// Current working directory - return empty string for browser
const cwd = () => '';

// Platform detection - return 'browser' for browser environment
const platform = 'browser';

// Process ID - return 1 for browser
const pid = 1;

// Event handling - no-op for browser
const on = () => {};

// Next tick - use setTimeout with 0 delay
const nextTick = callback => setTimeout(callback, 0);

// Exit - no-op for browser
const exit = () => {};

// Command line arguments - return empty array for browser
const argv = [];

// Export the process object
module.exports = {
  env,
  hrtime,
  cwd,
  platform,
  pid,
  on,
  nextTick,
  exit,
  argv
};
