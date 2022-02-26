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
import { statusCommandLegacy } from '../../../src/commands/forceSourceStatus';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Source Status', () => {
  it('Should build the source status command with local flag', async () => {
    const localFlag = new ForceSourceStatusExecutor(SourceStatusFlags.Local);
    const flagCommand = localFlag.build({});
    expect(flagCommand.toCommand()).to.equal(
      `sfdx ${localFlag.params.command} --local`
    );
    expect(flagCommand.description).to.equal(
      nls.localize(localFlag.params.description.local)
    );
  });

  it('Should build the source status command with remote flag', async () => {
    const remoteFlag = new ForceSourceStatusExecutor(SourceStatusFlags.Remote);
    const flagCommand = remoteFlag.build({});
    expect(flagCommand.toCommand()).to.equal(
      `sfdx ${remoteFlag.params.command} --remote`
    );
    expect(flagCommand.description).to.equal(
      nls.localize(remoteFlag.params.description.remote)
    );
  });

  it('Should build the source status command with legacy version', async () => {
    const legacyFlag = new ForceSourceStatusExecutor(undefined, statusCommandLegacy);
    const flagCommand = legacyFlag.build({});
    expect(legacyFlag.params.command).to.contain(':legacy:');
    expect(flagCommand.toCommand()).to.equal(
      `sfdx ${legacyFlag.params.command}`
    );
    expect(flagCommand.description).to.equal(
      nls.localize(legacyFlag.params.description.default)
    );
  });
});
