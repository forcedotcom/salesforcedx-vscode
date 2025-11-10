// Suppress specific console warnings during tests
const originalWarn = console.warn;

console.warn = (...args) => {
    // Suppress the eslint-tool warning from any package
    // This log clutters the output and is not useful, hence we suppress it
    if (args[0] && args[0].includes('core eslint-tool not installed')) {
        return;
    }
    // Allow other warnings to pass through
    originalWarn.apply(console, args);
};
