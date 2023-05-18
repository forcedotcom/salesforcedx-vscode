/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil, Table } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { channelService } from '@salesforce/salesforcedx-utils-vscode';
import { forceConfigSet, ForceConfigSetExecutor } from '../../../src/commands';
import { CONFIG_SET_NAME, DEFAULT_USERNAME_KEY } from '../../../src/constants';
import { nls } from '../../../src/messages';

const sandbox = sinon.createSandbox();
let channelSpy: sinon.SinonSpy;
let setDefaultUsernameOrAliasStub: sinon.SinonStub;
let tableSpy: sinon.SinonSpy;

describe('Force Config Set', () => {
  const errorMessage = 'An error occurred.';
  const usernameOrAlias = 'test-username1@gmail.com';

  beforeEach(() => {
    channelSpy = sandbox.spy(channelService, 'appendLine');
    setDefaultUsernameOrAliasStub = sandbox.stub(ConfigUtil, 'setDefaultUsernameOrAlias');
    tableSpy = sandbox.spy(Table.prototype, 'createTable');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should set config with the given username or alias', async () => {
    await forceConfigSet(usernameOrAlias);
    expect(setDefaultUsernameOrAliasStub.callCount).to.equal(1);
    expect(setDefaultUsernameOrAliasStub.calledWith(usernameOrAlias)).to.equal(true);
  });

  it('should set config with first alias', async () => {
    const aliases = ['alias1', 'alias2'];
    const expectedAlias = aliases[0];
    await forceConfigSet(aliases.join(','));
    expect(setDefaultUsernameOrAliasStub.callCount).to.equal(1);
    expect(setDefaultUsernameOrAliasStub.calledWith(expectedAlias)).to.equal(true);
  });

  it('should display formatted output in output channel', async () => {
    const expectedOutput = 'Successful table row';
    sandbox.stub(ForceConfigSetExecutor.prototype as any, 'formatOutput').returns(expectedOutput);
    await forceConfigSet(usernameOrAlias);
    expect(channelSpy.callCount).to.equal(1);
    expect(channelSpy.calledWith(expectedOutput)).to.equal(true);
  });

  it('should display correct output to user', async () => {
    const outputTableRow = { name: DEFAULT_USERNAME_KEY, val: usernameOrAlias, success: String(true) };
    const forceConfigSetInstance = new ForceConfigSetExecutor(usernameOrAlias);
    const formatOutput = (forceConfigSetInstance as any).formatOutput(outputTableRow);
    expect(tableSpy.callCount).to.equal(1);
    expect(formatOutput).to.contain(nls.localize(CONFIG_SET_NAME), DEFAULT_USERNAME_KEY);
    expect(formatOutput).to.contain(usernameOrAlias, String(true));
  });

  it('should display error message in output channel', async () => {
    setDefaultUsernameOrAliasStub.throws(new Error(errorMessage));
    await forceConfigSet(usernameOrAlias);
    expect(channelSpy.callCount).to.equal(2);
    expect(channelSpy.lastCall.args.length).to.equal(1);
    expect(channelSpy.lastCall.args[0]).to.contain(errorMessage);
  });
});
