/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxCommandBuilder } from '../../../src/cli/sfdxCommandBuilder';
import { SFDX_COMMAND } from '../../../src/constants';

describe('sfdxCommandBuilder unit tests.', () => {
  it('Should default to sfdx command.', () => {
    const sfdxCommandBuilderInst = new SfdxCommandBuilder();
    expect(sfdxCommandBuilderInst.command).toEqual(SFDX_COMMAND);
  });
});
