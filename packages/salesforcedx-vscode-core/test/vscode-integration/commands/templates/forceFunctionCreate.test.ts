/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceFunctionCreateExecutor } from '../../../../src/commands/templates/forceFunctionCreate';
import { nls } from '../../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Apex Function Create', () => {

  it('Should build apex function create command for javascript', async () => {
    const funcCreate = new ForceFunctionCreateExecutor();
    const fileName = 'myFunc1';
    const funcCreateCmd = funcCreate.build({ fileName, language: 'javascript', outputdir: '' });

    expect(funcCreateCmd.toCommand()).to.equal('sfdx evergreen:function:create myFunc1 --language javascript');
    expect(funcCreateCmd.description).to.equal(nls.localize('force_function_create_text'));
    expect(funcCreate.getFileExtension()).to.equal('.js');
  });

  it('Should build apex function create command for typescript', async () => {
    const funcCreate = new ForceFunctionCreateExecutor();
    const fileName = 'myFunc2';
    const funcCreateCmd = funcCreate.build({ fileName, language: 'typescript', outputdir: '' });

    expect(funcCreateCmd.toCommand()).to.equal('sfdx evergreen:function:create myFunc2 --language typescript');
    expect(funcCreateCmd.description).to.equal(nls.localize('force_function_create_text'));
    expect(funcCreate.getFileExtension()).to.equal('.ts');
  });
});
