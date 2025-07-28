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
const nextTick = callback => setTimeout(callback, 0);

// Exit - no-op for browser
const exit = () => {};

// Command line arguments - return empty array for browser
const argv = [];

// The process object with complete EventEmitter API
const process = {
  env,
  hrtime,
  cwd,
  platform,
  pid,
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
