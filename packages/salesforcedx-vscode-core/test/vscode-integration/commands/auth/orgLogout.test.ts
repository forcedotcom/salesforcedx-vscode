/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core-bundle';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { OrgLogoutAll, orgLogoutDefault } from '../../../../src/commands';
import { SfCommandlet } from '../../../../src/commands/util';
import { nls } from '../../../../src/messages';
import { telemetryService } from '../../../../src/telemetry';
import { OrgAuthInfo } from '../../../../src/util';

describe('Org Logout All', () => {
  it('Should build the auth logout all command', async () => {
    const authLogoutAll = new OrgLogoutAll();
    const authLogoutAllCommand = authLogoutAll.build({});
    expect(authLogoutAllCommand.toCommand()).to.equal(
      'sf org:logout --all --no-prompt'
    );
    expect(authLogoutAllCommand.description).to.equal(
      nls.localize('org_logout_all_text')
    );
  });
});

describe('Org Logout Default', () => {
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
    getUsernameStub = sb.stub(OrgAuthInfo, 'getTargetOrgOrAlias');
    scratchOrgStub = sb.stub(OrgAuthInfo, 'isAScratchOrg');
    notificationStub = sb.stub(notificationService, 'showInformationMessage');
    sendExceptionStub = sb.stub(telemetryService, 'sendException');
    commandletStub = sb.stub(SfCommandlet.prototype, 'run');
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

    await orgLogoutDefault();

    expect(getUsernameStub.called, 'should have requested target org').to.equal(
      true
    );
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

    await orgLogoutDefault();

    expect(getUsernameStub.called, 'should have requested target org').to.equal(
      true
    );
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

    await orgLogoutDefault();

    expect(getUsernameStub.called, 'should have requested target org').to.equal(
      true
    );
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

    await orgLogoutDefault();

    expect(getUsernameStub.called, 'should have requested target org').to.equal(
      true
    );
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

    await orgLogoutDefault();

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
      nls.localize('org_logout_scratch_prompt', username),
      { modal: true },
      nls.localize('org_logout_scratch_logout')
    ]);
  });

  it('Should allow logout for a scratch org', async () => {
    let removedUsername;
    const logoutResponse = nls.localize('org_logout_scratch_logout');

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

    await orgLogoutDefault();

    expect(
      sendExceptionStub.called,
      'should not have reported an error'
    ).to.equal(false);
    expect(
      notificationStub.callCount,
      'should not have posted an error message'
    ).to.equal(1);
    const notificationArgs = notificationStub.getCall(0).args;
    expect(notificationArgs).to.deep.equal([
      'SFDX: Log Out from Default Org successfully ran',
      'Show',
      'Show Only in Status Bar'
    ]);
    expect(inputMessageStub.called, 'should have prompted a message').to.equal(
      true
    );
    const messageArgs = inputMessageStub.getCall(0).args;
    expect(messageArgs).to.deep.equal([
      nls.localize('org_logout_scratch_prompt', username),
      { modal: true },
      logoutResponse
    ]);
    expect(removedUsername, 'should have removed username').to.equal(username);
  });
});
