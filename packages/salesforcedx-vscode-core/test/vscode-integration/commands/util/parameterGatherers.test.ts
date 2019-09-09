/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { SimpleGatherer } from '../../../../src/commands/util';

describe('Parameter Gatherers', () => {
  describe('SimpleGatherer', () => {
    it('Should gather input that was given into a ContinueResponse', async () => {
      const input = { a: 'a', b: true, c: 2 };
      const response = await new SimpleGatherer(input).gather();
      expect(response).to.eql({
        type: 'CONTINUE',
        data: input
      });
    });
  });
});
