const originalInfo = console.info;

console.log = () => {
  // Suppress all console.log during tests to avoid noise
  return;
};

console.info = (...args) => {
  // Suppress indexer info logs during tests
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Indexed')) {
    return;
  }
  originalInfo.apply(console, args);
};
