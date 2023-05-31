/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, StateAggregator } from '@salesforce/core';
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { OrgAuthInfo } from '../../../src/util';

describe('OrgAuthInfo', () => {
  const sandbox = createSandbox();

  const username = 'user@test.test';
  let getDefaultDevHubUsernameOrAliasStub: SinonStub;

  beforeEach(async () => {
    getDefaultDevHubUsernameOrAliasStub = sandbox.stub(
      ConfigUtil,
      'getDefaultDevHubUsernameOrAlias'
    );
  });

  afterEach(() => sandbox.restore());

  describe('getUsername', () => {
    const alias = 'TestOrg';

    it('should return the given username if there is no alias', async () => {
      const actualUsername = await OrgAuthInfo.getUsername(username);
      expect(actualUsername).to.equal(username);
    });

    it('should return the given value if there is no alias', async () => {
      const result = await OrgAuthInfo.getUsername(undefined!);
      expect(result).to.equal(undefined);
    });

    it('should return the username for the matching alias', async () => {
      const info = await StateAggregator.getInstance();
      sandbox
        .stub(info.aliases, 'getUsername')
        .withArgs(alias)
        .returns(username);
      expect(await OrgAuthInfo.getUsername(alias)).to.equal(username);
    });
  });

  describe('getDefaultDevHubUsernameOrAlias', () => {
    it('should return notification if there is no dev hub set', async () => {
      getDefaultDevHubUsernameOrAliasStub.resolves(undefined);
      const infoMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );

      await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

      expect(infoMessageStub.calledOnce).to.equal(true);
    });

    it('should run authorize a dev hub command if button clicked', async () => {
      getDefaultDevHubUsernameOrAliasStub.resolves(undefined);
      const showMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
      showMessageStub.returns(nls.localize('notification_make_default_dev'));
      const executeCommandStub = sandbox.stub(
        vscode.commands,
        'executeCommand'
      );

      await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

      expect(executeCommandStub.calledWith('sfdx.force.auth.dev.hub')).to.equal(
        true
      );
      expect(showMessageStub.calledOnce).to.equal(true);
    });

    it('should not show a message if there is a dev hub set', async () => {
      getDefaultDevHubUsernameOrAliasStub.resolves('username');
      const infoMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );

      await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

      expect(getDefaultDevHubUsernameOrAliasStub.calledOnce).to.equal(true);
      expect(infoMessageStub.calledOnce).to.equal(false);
    });
  });

  describe('getConnection', () => {
    const fakeAuthInfo = {
      authy: true
    };
    const fakeConnection = {
      connected: true
    };
    const defaultUsername = 'defaultUsername';

    let authinfoCreateStub: SinonStub;
    let connectionCreateStub: SinonStub;

    beforeEach(() => {
      authinfoCreateStub = sandbox
        .stub(AuthInfo, 'create')
        .resolves(fakeAuthInfo);
      connectionCreateStub = sandbox
        .stub(Connection, 'create')
        .resolves(fakeConnection);
    });

    it('should use username/alias when passed as argument', async () => {
      const connection = await OrgAuthInfo.getConnection(username);
      expect(connection).to.equal(fakeConnection);
      expect(authinfoCreateStub.calledWith({ username })).to.equal(true);
      expect(
        connectionCreateStub.calledWith({ authInfo: fakeAuthInfo })
      ).to.equal(true);
    });

    it('should use default username/alias when invoked without argument', async () => {
      const configUtilStub = sandbox.stub(
        ConfigUtil,
        'getDefaultUsernameOrAlias'
      );
      configUtilStub.returns(defaultUsername);

      const connection = await OrgAuthInfo.getConnection();
      expect(connection).to.equal(fakeConnection);
      expect(
        authinfoCreateStub.calledWith({
          username: defaultUsername
        })
      ).to.equal(true);
      expect(
        connectionCreateStub.calledWith({ authInfo: fakeAuthInfo })
      ).to.equal(true);
    });
  });
});
