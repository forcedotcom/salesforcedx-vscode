const baseConfig =  require('../../config/jest.base.config');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = Object.assign({},
  baseConfig,
  {
    testMatch: [ "**/unit/?(*.)+(spec|test).[t]s?(x)" ]
  }
);