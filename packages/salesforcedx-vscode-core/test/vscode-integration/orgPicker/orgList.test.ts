/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, StateAggregator } from '@salesforce/core';
import { fail } from 'assert';
import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { FileInfo, OrgList } from '../../../src/orgPicker';
import { OrgAuthInfo } from '../../../src/util';

const sandbox = createSandbox();

describe('orgList Tests', () => {
  afterEach(() => {
    sandbox.restore();
  });

  describe('getAuthInfoObjects', () => {
    let getAuthInfoListAllAuthorizationsStub: SinonStub;

    beforeEach(() => {
      getAuthInfoListAllAuthorizationsStub = sandbox.stub(
        AuthInfo,
        'listAllAuthorizations'
      );
    });

    it('should return a list of FileInfo objects when given an array of file names', async () => {
      const authFilesArray = [
        { username: 'test-username1@example.com' },
        { username: 'test-username2@example.com' }
      ];
      getAuthInfoListAllAuthorizationsStub.resolves(authFilesArray);
      // readFileSync is used to load test files on the fly so we need to
      // ensure we only stub calls to the fake authFiles.
      const readFileStub = sandbox.stub(fs, 'readFileSync');
      // Will only reurn when the arg includes the username.
      readFileStub.withArgs(sinon.match(authFilesArray[0].username)).returns(
        JSON.stringify({
          orgId: '000',
          accessToken: '000',
          refreshToken: '000',
          instanceUrl: '000',
          loginUrl: '000',
          username: 'test-username1@example.com'
        })
      );
      readFileStub.withArgs(sinon.match(authFilesArray[1].username)).returns(
        JSON.stringify({
          orgId: '111',
          accessToken: '111',
          refreshToken: '111',
          instanceUrl: '111',
          loginUrl: '111',
          username: 'test-username2@example.com'
        })
      );
      // Call the stubbed function if not matching the above withArgs.
      readFileStub.callThrough();
      const orgList = new OrgList();

      const authInfoObjects = await orgList.getAuthInfoObjects();
      if (authInfoObjects) {
        expect(authInfoObjects.length).to.equal(2);

        expect(authInfoObjects[0].username).to.equal(
          'test-username1@example.com'
        );
        expect(authInfoObjects[1].username).to.equal(
          'test-username2@example.com'
        );
      } else {
        fail('Should have populated authInfoObjects');
      }
    });

    it('should return null when no auth files are present', async () => {
      const orgList = new OrgList();
      getAuthInfoListAllAuthorizationsStub.resolves(null);
      const authInfoObjects = await orgList.getAuthInfoObjects();
      expect(authInfoObjects).to.equal(null);
    });

    describe('Filter Authorization Info', async () => {
      let defaultDevHubStub: SinonStub;
      let getUsernameStub: SinonStub;
      let stateAggregatorCreateStub: SinonStub;
      let getAllStub: SinonStub;
      const orgList = new OrgList();

      let fakeStateAggregator: any;

      beforeEach(() => {
        defaultDevHubStub = sandbox.stub(
          OrgAuthInfo,
          'getDefaultDevHubUsernameOrAlias'
        );
        getUsernameStub = sandbox.stub(OrgAuthInfo, 'getUsername');

        getAllStub = sandbox.stub();
        fakeStateAggregator = {
          aliases: {
            getAll: getAllStub
          }
        };
        stateAggregatorCreateStub = sandbox
          .stub(StateAggregator, 'create')
          .resolves(fakeStateAggregator);
      });

      it('should filter the list for users other than admins when scratchadminusername field is present', async () => {
        const authInfoObjects: FileInfo[] = [
          JSON.parse(
            JSON.stringify({
              orgId: '000',
              accessToken: '000',
              refreshToken: '000',
              scratchAdminUsername: 'nonadmin@user.com',
              username: 'test-username1@example.com'
            })
          ),
          JSON.parse(
            JSON.stringify({
              orgId: '111',
              accessToken: '111',
              refreshToken: '111',
              username: 'test-username2@example.com'
            })
          )
        ];
        defaultDevHubStub.resolves(null);
        getAllStub.returns([]);
        const authList = await orgList.filterAuthInfo(authInfoObjects);
        expect(authList[0]).to.equal('test-username2@example.com');
        expect(stateAggregatorCreateStub.calledOnce).to.equal(true);
      });

      it('should filter the list to only show scratch orgs associated with current default dev hub without an alias', async () => {
        const authInfoObjects: FileInfo[] = [
          JSON.parse(
            JSON.stringify({
              orgId: '000',
              username: 'test-scratchorg1@example.com',
              devHubUsername: 'test-devhub1@example.com'
            })
          ),
          JSON.parse(
            JSON.stringify({
              orgId: '111',
              username: 'test-scratchorg2@example.com',
              devHubUsername: 'test-devhub2@example.com'
            })
          )
        ];
        defaultDevHubStub.resolves('test-devhub1@example.com');
        getUsernameStub.resolves('test-devhub1@example.com');
        getAllStub.returns([]);
        const authList = await orgList.filterAuthInfo(authInfoObjects);
        expect(authList[0]).to.equal('test-scratchorg1@example.com');
      });

      it('should filter the list to only show scratch orgs associated with current default dev hub with an alias', async () => {
        const authInfoObjects: FileInfo[] = [
          JSON.parse(
            JSON.stringify({
              orgId: '000',
              username: 'test-scratchorg1@example.com',
              devHubUsername: 'test-devhub1@example.com'
            })
          ),
          JSON.parse(
            JSON.stringify({
              orgId: '111',
              username: 'test-scratchorg2@example.com',
              devHubUsername: 'test-devhub2@example.com'
            })
          )
        ];
        defaultDevHubStub.returns('dev hub alias');
        getUsernameStub.resolves('test-devhub1@example.com');
        getAllStub.returns([]);
        const authList = await orgList.filterAuthInfo(authInfoObjects);
        expect(authList[0]).to.equal('test-scratchorg1@example.com');
      });

      it('should display alias with username when alias is available', async () => {
        const authInfoObjects: FileInfo[] = [
          JSON.parse(
            JSON.stringify({
              orgId: '000',
              accessToken: '000',
              refreshToken: '000',
              username: 'test-username1@example.com'
            })
          ),
          JSON.parse(
            JSON.stringify({
              orgId: '111',
              accessToken: '111',
              refreshToken: '111',
              username: 'test-username2@example.com'
            })
          )
        ];
        defaultDevHubStub.resolves(null);
        getAllStub.onFirstCall().returns(['alias1']);
        getAllStub.returns([]);
        const authList = await orgList.filterAuthInfo(authInfoObjects);
        expect(authList[0]).to.equal('alias1 - test-username1@example.com');
      });

      it('should flag the org as expired if expiration date has passed', async () => {
        const oneDayMillis = 60 * 60 * 24 * 1000;
        const today = new Date();
        const yesterday = new Date(today.getTime() - oneDayMillis);
        const tomorrow = new Date(today.getTime() + oneDayMillis);

        const authInfoObjects: FileInfo[] = [
          JSON.parse(
            JSON.stringify({
              orgId: '000',
              username: 'test-scratchorg-today@example.com',
              devHubUsername: 'test-devhub1@example.com',
              expirationDate: today.toISOString().split('T')[0]
            })
          ),
          JSON.parse(
            JSON.stringify({
              orgId: '111',
              username: 'test-scratchorg-yesterday@example.com',
              devHubUsername: 'test-devhub1@example.com',
              expirationDate: yesterday.toISOString().split('T')[0]
            })
          ),
          JSON.parse(
            JSON.stringify({
              orgId: '222',
              username: 'test-scratchorg-tomorrow@example.com',
              devHubUsername: 'test-devhub1@example.com',
              expirationDate: tomorrow.toISOString().split('T')[0]
            })
          )
        ];
        defaultDevHubStub.resolves('test-devhub1@example.com');
        getUsernameStub.resolves('test-devhub1@example.com');
        getAllStub.returns([]);
        const authList = await orgList.filterAuthInfo(authInfoObjects);
        expect(authList[0]).to.equal(
          'test-scratchorg-today@example.com - ' +
            nls.localize('org_expired') +
            ' ' +
            String.fromCodePoint(0x274c)
        );
        expect(authList[1]).to.equal(
          'test-scratchorg-yesterday@example.com - ' +
            nls.localize('org_expired') +
            ' ' +
            String.fromCodePoint(0x274c)
        );
        expect(authList[2]).to.equal('test-scratchorg-tomorrow@example.com');
      });
    });

    describe('Set Default Org', () => {
      let orgListStub: SinonStub;
      let quickPickStub: SinonStub;
      let executeCommandStub: SinonStub;
      const orgsList = [
        'alias - test-username1@example.com',
        'test-username2@example.com'
      ];
      const orgList = new OrgList();

      beforeEach(() => {
        orgListStub = sandbox.stub(OrgList.prototype, 'updateOrgList');
        quickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
      });

      it('should return Cancel if selection is undefined', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns(undefined);
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CANCEL');
      });

      it('should return Continue and call force:auth:web:login command if SFDX: Authorize an Org is selected', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns(
          '$(plus) ' + nls.localize('force_auth_web_login_authorize_org_text')
        );
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CONTINUE');
        const commandResult = expect(
          executeCommandStub.calledWith('sfdx.force.auth.web.login')
        ).to.equal(true);
      });

      it('should return Continue and call force:org:create command if SFDX: Create a Default Scratch Org is selected', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns(
          '$(plus) ' + nls.localize('force_org_create_default_scratch_org_text')
        );
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CONTINUE');
        const commandResult = expect(
          executeCommandStub.calledWith('sfdx.force.org.create')
        ).to.equal(true);
      });

      it('should return Continue and call force:auth:dev:hub command if SFDX: Authorize a Dev Hub is selected', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns(
          '$(plus) ' +
            nls.localize('force_auth_web_login_authorize_dev_hub_text')
        );
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CONTINUE');
        const commandResult = expect(
          executeCommandStub.calledWith('sfdx.force.auth.dev.hub')
        ).to.equal(true);
      });

      it('should return Continue and call sfdx:force:auth:accessToken command if SFDX: Authorize an Org using Session ID', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns(
          '$(plus) ' +
            nls.localize('force_auth_access_token_authorize_org_text')
        );
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CONTINUE');
        const commandResult = expect(
          executeCommandStub.calledWith('sfdx.force.auth.accessToken')
        ).to.equal(true);
      });

      it('should return Continue and call force:org:list:clean command if SFDX: Remove Deleted and Expired Orgs is selected', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns(
          '$(plus) ' + nls.localize('force_org_list_clean_text')
        );
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CONTINUE');
        const commandResult = expect(
          executeCommandStub.calledWith('sfdx.force.org.list.clean')
        ).to.equal(true);
      });

      it('should return Continue and call force:config:set command if a username/alias is selected', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns('$(plus)' + orgsList[0].split(' ', 1));
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CONTINUE');
        const commandResult = expect(
          executeCommandStub.calledWith('sfdx.force.config.set')
        ).to.equal(true);
      });
    });
  });
});
