const baseConfig =  require('../../config/jest.integration.config');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = Object.assign({},
  baseConfig,
  {}
);