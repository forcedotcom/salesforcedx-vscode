/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import {
  ForceAuthLogoutAll,
  forceAuthLogoutDefault
} from '../../../../src/commands';
import { SfdxCommandlet } from '../../../../src/commands/util';
import { nls } from '../../../../src/messages';
import { telemetryService } from '../../../../src/telemetry';
import { OrgAuthInfo } from '../../../../src/util';

describe('Force Auth Logout All', () => {
  it('Should build the auth logout all command', async () => {
    const authLogoutAll = new ForceAuthLogoutAll();
    const authLogoutAllCommand = authLogoutAll.build({});
    expect(authLogoutAllCommand.toCommand()).to.equal(
      'sfdx force:auth:logout --all --noprompt'
    );
    expect(authLogoutAllCommand.description).to.equal(
      nls.localize('force_auth_logout_all_text')
    );
  });
});

describe('Force Auth Logout Default', () => {
  let sb: SinonSandbox;
  let getUsernameStub: SinonStub;
  let scratchOrgStub: SinonStub;
  let notificationStub: SinonStub;
  let sendExceptionStub: SinonStub;
  let commandletStub: SinonStub;
  let inputMessageStub: SinonStub;
  let authRemoverStub: SinonStub;
  const alias = 'test user 1';
  const username = 'test-username1@example.com';

  beforeEach(() => {
    sb = createSandbox();
    getUsernameStub = sb.stub(OrgAuthInfo, 'getDefaultUsernameOrAlias');
    scratchOrgStub = sb.stub(OrgAuthInfo, 'isAScratchOrg');
    notificationStub = sb.stub(notificationService, 'showInformationMessage');
    sendExceptionStub = sb.stub(telemetryService, 'sendException');
    commandletStub = sb.stub(SfdxCommandlet.prototype, 'run');
    inputMessageStub = sb.stub(vscode.window, 'showInformationMessage');
    authRemoverStub = sb.stub(AuthRemover, 'create');
  });

  afterEach(() => {
    sb.restore();
  });

  it('Should post a message for no default org', async () => {
    getUsernameStub.resolves(undefined);
    scratchOrgStub.resolves(false);
    notificationStub.resolves();

    await forceAuthLogoutDefault();

    expect(
      getUsernameStub.called,
      'should have requested default username'
    ).to.equal(true);
    expect(
      sendExceptionStub.called,
      'should not have reported an error'
    ).to.equal(false);
    expect(notificationStub.called, 'should have posted a message').to.equal(
      true
    );
    const notificationArgs = notificationStub.getCall(0).args;
    expect(notificationArgs[0]).to.equal('No default org to logout from');
  });

  it('Should handle an aliased org', async () => {
    getUsernameStub.resolves(alias);
    scratchOrgStub.resolves(false);
    notificationStub.resolves();

    await forceAuthLogoutDefault();

    expect(
      getUsernameStub.called,
      'should have requested default username'
    ).to.equal(true);
    expect(
      notificationStub.called,
      'should not have posted an error message'
    ).to.equal(false);
    expect(commandletStub.called).to.equal(true);
  });

  it('Should handle an un-aliased org', async () => {
    getUsernameStub.resolves(username);
    scratchOrgStub.resolves(false);
    notificationStub.resolves();

    await forceAuthLogoutDefault();

    expect(
      getUsernameStub.called,
      'should have requested default username'
    ).to.equal(true);
    expect(
      notificationStub.called,
      'should not have posted an error message'
    ).to.equal(false);
    expect(commandletStub.called).to.equal(true);
  });

  it('Should post a choice for a scratch org', async () => {
    getUsernameStub.resolves(username);
    scratchOrgStub.resolves(true);
    notificationStub.resolves();

    await forceAuthLogoutDefault();

    expect(
      getUsernameStub.called,
      'should have requested default username'
    ).to.equal(true);
    expect(
      sendExceptionStub.called,
      'should not have reported an error'
    ).to.equal(false);
    expect(
      notificationStub.called,
      'should not have posted an error message'
    ).to.equal(false);
    expect(commandletStub.called).to.equal(true);
  });

  it('Should allow logout cancel for a scratch org', async () => {
    getUsernameStub.resolves(username);
    scratchOrgStub.resolves(true);
    notificationStub.resolves();
    inputMessageStub.returns(undefined);
    commandletStub.restore();

    await forceAuthLogoutDefault();

    expect(
      sendExceptionStub.called,
      'should not have reported an error'
    ).to.equal(false);
    expect(
      notificationStub.called,
      'should not have posted an error message'
    ).to.equal(false);
    expect(inputMessageStub.called, 'should have prompted a message').to.equal(
      true
    );
    const messageArgs = inputMessageStub.getCall(0).args;
    expect(messageArgs).to.deep.equal([
      nls.localize('auth_logout_scratch_prompt', username),
      { modal: true },
      nls.localize('auth_logout_scratch_logout')
    ]);
  });

  it('Should allow logout for a scratch org', async () => {
    let removedUsername;
    const logoutResponse = nls.localize('auth_logout_scratch_logout');

    getUsernameStub.resolves(username);
    scratchOrgStub.resolves(true);
    notificationStub.resolves();
    inputMessageStub.returns(logoutResponse);
    commandletStub.restore();
    authRemoverStub.resolves({
      removeAuth: (name: string) => {
        removedUsername = name;
      }
    });

    await forceAuthLogoutDefault();

    expect(
      sendExceptionStub.called,
      'should not have reported an error'
    ).to.equal(false);
    expect(
      notificationStub.callCount,
      'should not have posted an error message'
    ).to.equal(2);
    const notificationArgs = notificationStub.getCall(0).args;
    expect(notificationArgs).to.deep.equal([
      'SFDX: Set a Default Org successfully ran',
      'Show',
      'Show Only in Status Bar'
    ]);
    expect(inputMessageStub.called, 'should have prompted a message').to.equal(
      true
    );
    const messageArgs = inputMessageStub.getCall(0).args;
    expect(messageArgs).to.deep.equal([
      nls.localize('auth_logout_scratch_prompt', username),
      { modal: true },
      logoutResponse
    ]);
    expect(removedUsername, 'should have removed username').to.equal(username);
  });
});
