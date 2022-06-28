/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { createSandbox } from 'sinon';
import * as vscode from 'vscode';
import { ForceConfigSetExecutor } from '../../../src/commands';

const env = createSandbox();
let openTextDocumentSpy: sinon.SinonSpy;

describe('Force Config Set', () => {
  beforeEach(() => {
    openTextDocumentSpy = env.spy(vscode.workspace, 'openTextDocument');
  });

  afterEach(() => {
    env.restore();
  });

  it('should build the force config set command', async () => {
    const usernameOrAlias = 'test-username1@gmail.com';
    const forceConfigSet = new ForceConfigSetExecutor(usernameOrAlias);
    env.stub(forceConfigSet, 'run').returns(true);
    expect(forceConfigSet.getUsernameOrAlias()).to.equal(usernameOrAlias);
  });
  
  it('should build the force config set command with first alias', async () => {
    const aliases = ['alias1', 'alias2'];
    const expectedAlias = aliases[0];
    const forceConfigSet = new ForceConfigSetExecutor(aliases.join(','));
    env.stub(forceConfigSet, 'run').returns(true);
    expect(forceConfigSet.getUsernameOrAlias()).to.equal(expectedAlias);
  });
});