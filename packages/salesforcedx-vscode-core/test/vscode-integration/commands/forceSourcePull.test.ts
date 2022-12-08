/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceSourcePullExecutor } from '../../../src/commands';
import { pullCommandLegacy } from '../../../src/commands/forceSourcePull';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Source Pull', () => {
  it('Should build the source pull command with no flag', async () => {
    const sourcePullNoFlag = new ForceSourcePullExecutor();
    const pullCommand = sourcePullNoFlag.build({});
    expect(pullCommand.toCommand()).to.equal(`sfdx ${sourcePullNoFlag.params.command}`);
    expect(pullCommand.description).to.equal(
      nls.localize('force_source_pull_default_scratch_org_text')
    );
  });

  it('Should build the source pull command with overwrite flag', async () => {
    const sourcePullOverwrite = new ForceSourcePullExecutor('--forceoverwrite');
    const pullCommand = sourcePullOverwrite.build({});
    expect(pullCommand.toCommand()).to.equal(
      `sfdx ${sourcePullOverwrite.params.command} --forceoverwrite`
    );
    expect(pullCommand.description).to.equal(
      nls.localize('force_source_pull_force_default_scratch_org_text')
    );
  });

  it('Should build the source pull command with legacy version', async () => {
    const legacyFlag = new ForceSourcePullExecutor('--forceoverwrite', pullCommandLegacy);
    const flagCommand = legacyFlag.build({});
    expect(legacyFlag.params.command).to.contain(':legacy:');
    expect(flagCommand.toCommand()).to.equal(
      `sfdx ${legacyFlag.params.command} --forceoverwrite`
    );
    expect(flagCommand.description).to.equal(
      nls.localize(legacyFlag.params.description.forceoverwrite)
    );
  });
});
