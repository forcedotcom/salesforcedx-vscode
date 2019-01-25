/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Aliases, AuthInfo } from '@salesforce/core';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import fs = require('fs');
import { nls } from '../../../src/messages';
import { FileInfo, OrgList, setDefaultOrg } from '../../../src/orgPicker';

describe('getAuthInfoObjects', () => {
  it('should return a list of FileInfo objects when given an array of file names', async () => {
    const authFilesArray = [
      'test-username1@gmail.com',
      'test-username2@gmail.com'
    ];
    const orgList = new OrgList();
    const listAuthFilesStub = getAuthInfoListAuthFilesStub(authFilesArray);
    const readFileStub = sinon
      .stub(fs, 'readFileSync')
      .onFirstCall()
      .returns(
        JSON.stringify({
          orgId: '000',
          accessToken: '000',
          refreshToken: '000',
          instanceUrl: '000',
          loginUrl: '000',
          username: 'test-username1@gmail.com'
        })
      );
    readFileStub.onSecondCall().returns(
      JSON.stringify({
        orgId: '111',
        accessToken: '111',
        refreshToken: '111',
        instanceUrl: '111',
        loginUrl: '111',
        username: 'test-username2@gmail.com'
      })
    );
    const authInfoObjects = await orgList.getAuthInfoObjects();
    if (!isNullOrUndefined(authInfoObjects)) {
      expect(authInfoObjects[0].username).to.equal('test-username1@gmail.com');
      expect(authInfoObjects[1].username).to.equal('test-username2@gmail.com');
    }
    listAuthFilesStub.restore();
    readFileStub.restore();
  });
  it('should return null when no auth files are present', async () => {
    const orgList = new OrgList();
    const listAuthFilesStub = getAuthInfoListAuthFilesStub(null);
    const authInfoObjects = await orgList.getAuthInfoObjects();
    expect(authInfoObjects).to.equal(null);
    listAuthFilesStub.restore();
  });
  const getAuthInfoListAuthFilesStub = (returnValue: any) =>
    sinon
      .stub(AuthInfo, 'listAllAuthFiles')
      .returns(Promise.resolve(returnValue));
});

/*describe('filterAuthInfo', async () => {
  const aliasCreateStub = (returnValue: any) =>
    sinon.stub(Aliases, 'create').returns(Promise.resolve(returnValue));
  const aliasKeysStub = (returnValue: any) =>
    sinon.stub(Aliases.prototype, 'getKeysByValue').returns(returnValue);
  it('should return list of usernames when no aliases are present', async () => {
    const authInfoObjects: FileInfo[] = [
      JSON.parse(
        JSON.stringify({
          orgId: '000',
          accessToken: '000',
          refreshToken: '000',
          instanceUrl: '000',
          loginUrl: '000',
          username: 'test-username1@gmail.com'
        })
      ),
      JSON.parse(
        JSON.stringify({
          orgId: '111',
          accessToken: '111',
          refreshToken: '111',
          instanceUrl: '111',
          loginUrl: '111',
          username: 'test-username2@gmail.com'
        })
      )
    ];
    const aliasListStub = await aliasCreateStub([]);
    const aliasKeyListStub = await aliasKeysStub([]);
    const orgList = new OrgList();
    const authList = await orgList.filterAuthInfo(authInfoObjects);
    expect(authList).to.equal([
      'test-username1@gmail.com',
      'test-username2@gmail.com'
    ]);
    aliasListStub.restore();
    aliasKeyListStub.restore();
  });
});*/

describe('Set Default Org', () => {
  let orgListStub: sinon.SinonStub;
  let quickPickStub: sinon.SinonStub;
  const orgList = [
    'alias - test-username1@gmail.com',
    'test-username2@gmail.com'
  ];

  beforeEach(() => {
    orgListStub = sinon.stub(OrgList.prototype, 'updateOrgList');
    quickPickStub = sinon.stub(vscode.window, 'showQuickPick');
  });
  afterEach(() => {
    orgListStub.restore();
    quickPickStub.restore();
  });

  it('should return Cancel if selection is undefined', async () => {
    orgListStub.returns(orgList);
    quickPickStub.returns(undefined);
    const response = await setDefaultOrg();
    expect(response.type).to.equal('CANCEL');
  });

  it('should return Continue and call force:auth:web:login command if SFDX: Authorize an Org is selected', async () => {
    orgListStub.returns(orgList);
    quickPickStub.returns(
      '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text')
    );
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    const response = await setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.auth.web.login')
    ).to.be.true;
    executeCommandStub.restore();
  });

  it('should return Continue and call force:org:create command if SFDX: Create a Default Scratch Org is selected', async () => {
    orgListStub.returns(orgList);
    quickPickStub.returns(
      '$(plus) ' + nls.localize('force_org_create_default_scratch_org_text')
    );
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    const response = await setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.org.create')
    ).to.be.true;
    executeCommandStub.restore();
  });

  it('should return Continue and call force:config:set command if a username/alias is selected', async () => {
    orgListStub.returns(orgList);
    quickPickStub.returns('$(plus)' + orgList[0].split(' ', 1));
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
    const response = await setDefaultOrg();
    expect(response.type).to.equal('CONTINUE');
    const commandResult = expect(
      executeCommandStub.calledWith('sfdx.force.config.set')
    ).to.be.true;
    executeCommandStub.restore();
  });
});
