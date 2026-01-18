// Polyfill for file descriptor operations that some Node.js modules check for
// This provides a minimal mock to prevent "Cannot read properties of undefined (reading 'fd')" errors
// in browser environments where file descriptors don't exist

// Create a mock file descriptor object
const mockFd = {
  fd: 0, // Default file descriptor
  readable: false,
  writable: false
};

// Export a function that returns a mock file descriptor
module.exports = mockFd;
module.exports.default = mockFd;
