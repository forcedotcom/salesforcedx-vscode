/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config } from '@salesforce/core';
import { Table } from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { channelService } from '../../../src/channels';
import { forceConfigSet, ForceConfigSetExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

const CONFIG_KEY = nls.localize('force_config_set_name');

const sandbox = sinon.createSandbox();
let channelSpy: sinon.SinonSpy;
let configSetSpy: sinon.SinonSpy;
let configWriteSpy: sinon.SinonSpy;
let tableSpy: sinon.SinonSpy;

describe('Force Config Set', () => {
  beforeEach(() => {
    channelSpy = sandbox.spy(channelService, 'appendLine');
    configSetSpy = sandbox.spy(Config.prototype, 'set');
    configWriteSpy = sandbox.spy(Config.prototype, 'write');
    tableSpy = sandbox.spy(Table.prototype, 'createTable');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should set config with given username or alias', async () => {
    const usernameOrAlias = 'test-username1@gmail.com';
    await forceConfigSet(usernameOrAlias);
    expect(configSetSpy.calledOnce);
    expect(configSetSpy.calledWith(CONFIG_KEY, usernameOrAlias)).to.equal(true);
    expect(configWriteSpy.calledOnce);
  });

  it('should set config with first alias', async () => {
    const aliases = ['alias1', 'alias2'];
    const expectedAlias = aliases[0];
    await forceConfigSet(aliases.join(','));
    expect(configSetSpy.callCount).to.equal(1);
    expect(configSetSpy.calledWith(CONFIG_KEY, expectedAlias)).to.equal(true);
  });

  it('should display formatted output in output channel', async () => {
    const usernameOrAlias = 'test-username1@gmail.com';
    const expectedOutput = 'Successful table row';
    sandbox.stub(ForceConfigSetExecutor.prototype as any, 'formatOutput').returns(expectedOutput);
    await forceConfigSet(usernameOrAlias);
    expect(channelSpy.calledWith(expectedOutput)).to.equal(true);
  });

  it('should format output correctly', async () => {
    const usernameOrAlias = 'test-username1@gmail.com';
    const outputTableRow = { name: CONFIG_KEY, val: usernameOrAlias, success: String(true) };
    const forceConfigSetInstance = new ForceConfigSetExecutor(usernameOrAlias);
    const formatOutput = (forceConfigSetInstance as any).formatOutput(outputTableRow);
    expect(tableSpy.calledOnce);
    expect(formatOutput).to.equal('=== Set Config\nName             Value                     Success\n───────────────  ────────────────────────  ───────\ndefaultusername  test-username1@gmail.com  true   \n');
  });
});
