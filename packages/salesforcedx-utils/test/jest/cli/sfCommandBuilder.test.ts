/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfCommandBuilder } from '../../../src/cli/sfCommandBuilder';
import { SF_COMMAND } from '../../../src/constants';

describe('sfCommandBuilder unit tests.', () => {
  it('Should default to sf command.', () => {
    const sfCommandBuilderInst = new SfCommandBuilder();
    expect(sfCommandBuilderInst.command).toEqual(SF_COMMAND);
  });
});
