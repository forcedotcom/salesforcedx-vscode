/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint:disable-next-line:no-var-requires
const baseConfig = require('../../config/jest.base.config');

module.exports = Object.assign({}, baseConfig, {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/test/jest/queryDataView/queryDataViewController.test.ts'],
  modulePathIgnorePatterns: [...(baseConfig.modulePathIgnorePatterns || []), '<rootDir>/.wireit/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  }
});
