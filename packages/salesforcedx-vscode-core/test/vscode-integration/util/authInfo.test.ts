/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Aliases } from '@salesforce/core';
import { expect } from 'chai';
import { sandbox } from 'sinon';
import * as util from 'util';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { ConfigUtil, OrgAuthInfo } from '../../../src/util';

const env = sandbox.create();

// tslint:disable: no-unused-expression
describe('OrgAuthInfo', () => {
  afterEach(() => env.restore());

  describe('getUsername', () => {
    const username = 'user@test.test';
    const alias = 'TestOrg';

    it('should return the given username or alias if there is no alias', async () => {
      expect(await OrgAuthInfo.getUsername(username)).to.equal(username);
      expect(await OrgAuthInfo.getUsername(undefined!)).to.equal(undefined);
    });

    it('should return the username for the matching alias', async () => {
      env
        .stub(Aliases, 'fetch')
        .withArgs(alias)
        .returns(username);
      expect(await OrgAuthInfo.getUsername(alias)).to.equal(username);
    });
  });

  describe('getDefaultDevHubUsernameOrAlias', () => {
    it('should return notification if there is no dev hub set', async () => {
      const configUtilStub = env.stub(ConfigUtil, 'getConfigValue');
      configUtilStub.returns(undefined);
      const infoMessageStub = env.stub(vscode.window, 'showInformationMessage');

      await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

      expect(infoMessageStub.calledOnce).to.be.true;
      configUtilStub.restore();
      infoMessageStub.restore();
    });

    it('should run authorize a dev hub command if button clicked', async () => {
      const configUtilStub = env.stub(ConfigUtil, 'getConfigValue');
      configUtilStub.returns(undefined);
      const showMessageStub = env.stub(vscode.window, 'showInformationMessage');
      showMessageStub.returns(nls.localize('notification_make_default_dev'));
      const executeCommandStub = env.stub(vscode.commands, 'executeCommand');

      await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

      expect(executeCommandStub.calledWith('sfdx.force.auth.dev.hub')).to.be
        .true;
      expect(showMessageStub.calledOnce).to.be.true;

      configUtilStub.restore();
      showMessageStub.restore();
      executeCommandStub.restore();
    });

    it('should not show a message if there is a dev hub set', async () => {
      const configUtilStub = env.stub(ConfigUtil, 'getConfigValue');
      configUtilStub.returns('username');
      const infoMessageStub = env.stub(vscode.window, 'showInformationMessage');

      await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

      expect(infoMessageStub.calledOnce).to.be.false;
      configUtilStub.restore();
      infoMessageStub.restore();
    });
  });

  describe('getConnection', () => {
    const username = 'user@test.test';
    const alias = 'TestOrg';

    it('with argument', async () => {
      const connection = await OrgAuthInfo.getConnection(username);
      expect(connection.getUsername()).to.equal(username);
    });

    it('without argument. Use default', async () => {
      const configUtilStub = env.stub(ConfigUtil, 'getConfigValue');
      configUtilStub.returns('defaultUsername');

      const connection = await OrgAuthInfo.getConnection();
      expect(connection.getUsername()).to.equal('defaultUsername');

      configUtilStub.restore();
    });
  });
});
