/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { ConfigUtil, OrgAuthInfo } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('getDefaultDevHubUsernameOrAlias', () => {
  it('should return notification if there is no dev hub set', async () => {
    const configUtilStub = sinon.stub(ConfigUtil, 'getConfigValue');
    configUtilStub.returns(undefined);
    const infoMessageStub = sinon.stub(vscode.window, 'showInformationMessage');

    await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

    expect(infoMessageStub.calledOnce).to.be.true;
    configUtilStub.restore();
    infoMessageStub.restore();
  });
  it('should run authorize a dev hub command if button clicked', async () => {
    const configUtilStub = sinon.stub(ConfigUtil, 'getConfigValue');
    configUtilStub.returns(undefined);
    const showMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
    showMessageStub.returns(nls.localize('notification_make_default_dev'));
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

    expect(executeCommandStub.calledWith('sfdx.force.auth.dev.hub')).to.be.true;
    expect(showMessageStub.calledOnce).to.be.true;

    configUtilStub.restore();
    showMessageStub.restore();
    executeCommandStub.restore();
  });

  it('should not show a message if there is a dev hub set', async () => {
    const configUtilStub = sinon.stub(ConfigUtil, 'getConfigValue');
    configUtilStub.returns('username');
    const infoMessageStub = sinon.stub(vscode.window, 'showInformationMessage');

    await OrgAuthInfo.getDefaultDevHubUsernameOrAlias(true);

    expect(infoMessageStub.calledOnce).to.be.false;
    configUtilStub.restore();
    infoMessageStub.restore();
  });
});
