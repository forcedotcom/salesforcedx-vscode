/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceSourcePushExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Source Push', () => {
  const commonParams = '--json --loglevel fatal';
  it('Should build the source push command with no flag', async () => {
    const sourcePushNoFlag = new ForceSourcePushExecutor();
    const pushCommand = sourcePushNoFlag.build({});
    expect(pushCommand.toCommand()).to.equal(
      `sfdx ${sourcePushNoFlag.params.command} ${commonParams}`
    );
    expect(pushCommand.description).to.equal(
      nls.localize('force_source_push_default_org_text')
    );
  });

  it('Should build the source push command with overwrite flag', async () => {
    const sourcePushOverwrite = new ForceSourcePushExecutor('--forceoverwrite');
    const pushCommand = sourcePushOverwrite.build({});
    expect(pushCommand.toCommand()).to.equal(
      `sfdx ${sourcePushOverwrite.params.command} ${commonParams} --forceoverwrite`
    );
    expect(pushCommand.description).to.equal(
      nls.localize('force_source_push_force_default_org_text')
    );
  });
});
