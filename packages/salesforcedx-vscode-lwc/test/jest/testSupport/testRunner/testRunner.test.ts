/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getTestNamePatternArgs } from '../../../../src/testSupport/testRunner/testRunner';

describe('testRunner Unit Tests.', () => {
  describe('test getTestNamePatternArgs', () => {
    it('Should return testNamePattern if flag is included', async () => {
      const testName = 'Testing is Fun!';
      const testPatternArgs = getTestNamePatternArgs(testName);
      expect(testPatternArgs.length).toEqual(2);
      expect(testPatternArgs).toMatchSnapshot();
    });
    it('Should escape certain symbols if testNamePattern is included', async () => {
      const testName = 'Test ?$^*().[]{}|+ Symbols';
      const testNameEscaped = 'Test \\?\\$\\^\\*\\(\\)\\.\\[\\]\\{\\}\\|\\+ Symbols';
      const testPatternArgs = getTestNamePatternArgs(testName);
      expect(testPatternArgs).toContain(testNameEscaped);
      expect(testPatternArgs).toMatchSnapshot();
    });
    it('Should not escape certain symbols if testNamePattern is included', async () => {
      const testName = 'Test !@#"%&;:,<>=~` Symbols';
      const testPatternArgs = getTestNamePatternArgs(testName);
      expect(testPatternArgs).toMatchSnapshot();
    });
  });
});
