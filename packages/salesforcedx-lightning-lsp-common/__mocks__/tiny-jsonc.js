// Mock for tiny-jsonc ES module - provides CommonJS-compatible interface for Jest
module.exports = {
  default: {
    parse: text => {
      // Simple JSONC parser that strips comments and trailing commas
      // This is a basic implementation for testing purposes
      let cleaned = text;

      // Remove single-line comments (// ...)
      cleaned = cleaned.replace(/\/\/.*$/gm, '');

      // Remove multi-line comments (/* ... */)
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

      // Remove trailing commas before } or ]
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        // Return empty object on parse error to match readJsonSync behavior
        return {};
      }
    }
  }
};
