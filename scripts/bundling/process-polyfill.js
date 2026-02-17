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

// Process versions - provide minimal version info for browser compatibility
// VS Code extensions may check process.versions.node to determine Node.js version
const versions = {
  node: '18.0.0',
  v8: '10.1.124.8',
  modules: '108',
  uv: '1.43.0', // Typical libuv version for Node 18
  zlib: '1.2.11', // Typical zlib version
  openssl: '3.0.7', // Typical OpenSSL version for Node 18
  nghttp2: '1.47.0', // Typical nghttp2 version
  napi: '9', // N-API version
  llhttp: '6.0.10', // Typical llhttp version
  http_parser: '2.9.4', // Typical http_parser version
  brotli: '1.0.9', // Typical brotli version
  ares: '1.18.1', // Typical c-ares version
  icu: '71.1', // Typical ICU version
  unicode: '14.0', // Typical Unicode version
  ngtcp2: '0.8.1', // Typical ngtcp2 version
  nghttp3: '0.7.0' // Typical nghttp3 version
};

// EventEmitter-like implementation for browser compatibility
// Initialize event storage
let _events = {};
let _maxListeners = 10;

// EventEmitter method implementations
const on = (type, listener) => {
  if (!_events[type]) _events[type] = [];
  _events[type].push(listener);
  return process;
};

const addListener = on;

const once = (type, listener) => {
  const wrapper = (...args) => {
    removeListener(type, wrapper);
    listener.apply(process, args);
  };
  return on(type, wrapper);
};

const off = (type, listener) => removeListener(type, listener);

const removeListener = (type, listener) => {
  if (_events[type]) {
    const index = _events[type].indexOf(listener);
    if (index !== -1) {
      _events[type].splice(index, 1);
    }
  }
  return process;
};

const removeAllListeners = type => {
  if (type !== undefined) {
    delete _events[type];
  } else {
    _events = {};
  }
  return process;
};

const emit = (type, ...args) => {
  if (_events[type]) {
    _events[type].forEach(listener => {
      try {
        listener.apply(process, args);
      } catch (err) {
        // Emit error on next tick to avoid breaking the current execution
        setTimeout(() => {
          throw err;
        }, 0);
      }
    });
    return true;
  }
  return false;
};

const prependListener = (type, listener) => {
  if (!_events[type]) _events[type] = [];
  _events[type].unshift(listener);
  return process;
};

const prependOnceListener = (type, listener) => {
  const wrapper = (...args) => {
    removeListener(type, wrapper);
    listener.apply(process, args);
  };
  return prependListener(type, wrapper);
};

const listeners = type => {
  return _events[type] ? [..._events[type]] : [];
};

// Next tick - use setTimeout with 0 delay
const nextTick = (callback, ...args) => setTimeout(() => callback(...args), 0);

// Exit - no-op for browser
const exit = () => {};

// Command line arguments - return empty array for browser
const argv = [];

// Mock stdin/stdout/stderr streams with fd property and isatty method to prevent errors
// isatty is a function from the tty module that checks if a file descriptor is a TTY
const mockStream = {
  fd: 0, // Default file descriptor
  isTTY: false,
  readable: false,
  writable: false,
  isatty: () => false // Always return false in browser (not a TTY)
};

// The process object with complete EventEmitter API
const process = {
  env,
  hrtime,
  cwd,
  platform,
  pid,
  version: 'v18.0.0',
  versions, // Add versions object for compatibility with VS Code extensions
  // Mock streams to prevent fd access errors
  stdin: mockStream,
  stdout: mockStream,
  stderr: mockStream,
  // EventEmitter methods
  on,
  addListener,
  once,
  off,
  removeListener,
  removeAllListeners,
  emit,
  prependListener,
  prependOnceListener,
  listeners,
  // Process methods
  nextTick,
  exit,
  argv,
  // EventEmitter properties
  _events,
  _maxListeners
};

// Export the process object
module.exports = process;
