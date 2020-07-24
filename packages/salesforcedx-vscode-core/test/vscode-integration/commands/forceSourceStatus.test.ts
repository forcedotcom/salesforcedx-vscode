/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  ForceSourceStatusExecutor,
  SourceStatusFlags
} from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Source Status', () => {
  it('Should build the source command with local flag', async () => {
    const localFlag = new ForceSourceStatusExecutor(SourceStatusFlags.Local);
    const flagCommand = localFlag.build({});
    expect(flagCommand.toCommand()).to.equal(
      'sfdx force:source:status --local'
    );
    expect(flagCommand.description).to.equal(
      nls.localize('force_source_status_local_text')
    );
  });
  it('Should build the source command with remote flag', async () => {
    const remoteFlag = new ForceSourceStatusExecutor(SourceStatusFlags.Remote);
    const flagCommand = remoteFlag.build({});
    expect(flagCommand.toCommand()).to.equal(
      'sfdx force:source:status --remote'
    );
    expect(flagCommand.description).to.equal(
      nls.localize('force_source_status_remote_text')
    );
  });
});
