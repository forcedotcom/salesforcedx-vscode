// Suppress specific console warnings during tests
const originalWarn = console.warn;
const originalLog = console.log;
const originalInfo = console.info;

console.warn = (...args) => {
    // Suppress the eslint-tool warning from any package
    // This log clutters the output and is not useful, hence we suppress it
    if (args[0] && args[0].includes('core eslint-tool not installed')) {
        return;
    }
    // Allow other warnings to pass through
    originalWarn.apply(console, args);
};

console.log = (...args) => {
    // Suppress all console.log during tests to avoid noise
    return;
};

console.info = (...args) => {
    // Suppress indexer info logs during tests
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Indexed')) {
        return;
    }
    // Allow other info logs to pass through
    originalInfo.apply(console, args);
};
