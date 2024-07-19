/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { DEV_SERVER_DEFAULT_BASE_URL } from '../../../src/commands/commandConstants';

describe('force:lightning:lwc:start constants', () => {
  describe('base url', () => {
    it('should include localhost', () => {
      expect(DEV_SERVER_DEFAULT_BASE_URL).to.include('localhost');
    });
  });
});
