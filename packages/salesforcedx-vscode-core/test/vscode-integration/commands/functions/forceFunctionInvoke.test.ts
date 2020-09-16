/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceFunctionInvoke as Unit } from '../../../../src/commands/functions/forceFunctionInvoke';
import { nls } from '../../../../src/messages';

describe('Force Apex Function Invoke', () => {
  it('Should build invoke command', async () => {
    const invokeFunc = new Unit();
    const payloadUri = '/some/path/payload.json';
    const funcInvokeCmd = invokeFunc.build(payloadUri);

    expect(funcInvokeCmd.toCommand()).to.equal(`sfdx evergreen:function:invoke http://localhost:8080 --payload @${payloadUri}`);
    expect(funcInvokeCmd.description).to.equal(nls.localize('force_function_invoke_text'));
  });
});
