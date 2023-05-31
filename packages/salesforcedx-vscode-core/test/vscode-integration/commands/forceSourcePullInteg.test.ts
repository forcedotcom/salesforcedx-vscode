/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceSourcePullExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

describe('Force Source Pull', () => {
  it('Should build the source pull command with the --json flag', async () => {
    const sourcePullNoFlag = new ForceSourcePullExecutor();
    const pullCommand = sourcePullNoFlag.build({});
    expect(pullCommand.toCommand()).to.equal(
      'sfdx force:source:pull --json --loglevel fatal'
    );
    expect(pullCommand.description).to.equal(
      nls.localize('force_source_pull_default_org_text')
    );
  });

  it('Should build the source pull command with overwrite flag', async () => {
    const sourcePullOverwrite = new ForceSourcePullExecutor('--forceoverwrite');
    const pullCommand = sourcePullOverwrite.build({});
    expect(pullCommand.toCommand()).to.equal(
      'sfdx force:source:pull --json --loglevel fatal --forceoverwrite'
    );
    expect(pullCommand.description).to.equal(
      nls.localize('force_source_pull_force_default_org_text')
    );
  });
});
