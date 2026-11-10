// fdir's optional CommonJS matcher probe is unused when tinyglobby supplies filters.
const unavailableRequire = () => {
  throw new Error('Node.js module loading is unavailable in browser bundles');
};

unavailableRequire.resolve = unavailableRequire;

export const createRequire = () => unavailableRequire;
