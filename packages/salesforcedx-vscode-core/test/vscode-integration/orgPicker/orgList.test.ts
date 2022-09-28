/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, OrgAuthorization, StateAggregator } from '@salesforce/core';
import { AliasAccessor } from '@salesforce/core/lib/stateAggregator';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { OrgList } from '../../../src/orgPicker';
import * as util from '../../../src/util';
import { ConfigUtil } from '../../../src/util';

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
      // Arrange
      const authFilesArray = [
        { username: 'test-username1@example.com' },
        { username: 'test-username2@example.com' }
      ];
      getAuthInfoListAllAuthorizationsStub.resolves(authFilesArray);
      const orgList = new OrgList();

      // Act
      const orgAuthorizations = await orgList.getOrgAuthorizations();

      // Assert
      expect(orgAuthorizations.length).to.equal(2);

      expect(orgAuthorizations[0].username).to.equal(
        'test-username1@example.com'
      );
      expect(orgAuthorizations[1].username).to.equal(
        'test-username2@example.com'
      );
    });

    it('should return null when no auth files are present', async () => {
      const orgList = new OrgList();
      getAuthInfoListAllAuthorizationsStub.resolves(null);
      const orgAuthorizations = await orgList.getOrgAuthorizations();
      expect(orgAuthorizations).to.equal(null);
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
          util.OrgAuthInfo,
          'getDefaultDevHubUsernameOrAlias'
        );
        getUsernameStub = sandbox.stub(util.OrgAuthInfo, 'getUsername');

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

      function getFakeOrgAuthorization(
        orgAuth?: Partial<OrgAuthorization>
      ): OrgAuthorization {
        const fakeOrgAuth: OrgAuthorization = {
          orgId: orgAuth?.orgId ?? '000',
          username: orgAuth?.username ?? 'test-username1@example.com',
          oauthMethod: orgAuth?.oauthMethod ?? 'unknown',
          aliases: orgAuth?.aliases ?? [],
          configs: orgAuth?.configs ?? [],
          isScratchOrg: orgAuth?.isScratchOrg ?? undefined,
          isDevHub: orgAuth?.isDevHub ?? undefined,
          isSandbox: orgAuth?.isSandbox ?? undefined,
          instanceUrl: orgAuth?.instanceUrl ?? undefined,
          accessToken: orgAuth?.accessToken ?? undefined,
          error: orgAuth?.error ?? undefined,
          isExpired: orgAuth?.isExpired ?? false
        };
        return fakeOrgAuth;
      }

      const dummyOrgAuth1 = getFakeOrgAuthorization({
        orgId: '000',
        username: 'test-username1@example.com'
      });
      const dummyOrgAuth2 = getFakeOrgAuthorization({
        orgId: '111',
        username: 'test-username2@example.com'
      });

      const dummyScratchOrgAuth1 = getFakeOrgAuthorization({
        orgId: '000',
        username: 'test-scratchorg1@example.com'
      });
      const dummyScratchOrgAuth2 = getFakeOrgAuthorization({
        orgId: '111',
        username: 'test-scratchorg2@example.com'
      });

      const dummyDevHubUsername1 = 'test-devhub1@example.com';
      const dummyDevHubUsername2 = 'test-devhub2@example.com';

      it('should filter the list for users other than admins when scratchadminusername field is present', async () => {
        // Arrange
        const authInfoObjects: OrgAuthorization[] = [
          dummyOrgAuth1,
          dummyOrgAuth2
        ];
        const getAuthFieldsForStub = sandbox.stub(orgList, 'getAuthFieldsFor');
        getAuthFieldsForStub
          .withArgs(dummyOrgAuth1.username)
          .returns({ scratchAdminUsername: 'nonadmin@user.com' });
        defaultDevHubStub.resolves(null);
        getAllStub.returns([]);

        // Act
        const authList = await orgList.filterAuthInfo(authInfoObjects);

        // Assert
        expect(authList[0]).to.equal('test-username2@example.com');
      });

      it('should filter the list to only show scratch orgs associated with current default dev hub without an alias', async () => {
        const authInfoObjects: OrgAuthorization[] = [
          dummyScratchOrgAuth1,
          dummyScratchOrgAuth2
        ];
        const getAuthFieldsForStub = sandbox.stub(orgList, 'getAuthFieldsFor');
        getAuthFieldsForStub.withArgs(dummyScratchOrgAuth1.username).returns({
          devHubUsername: dummyDevHubUsername1
        });
        getAuthFieldsForStub
          .withArgs(dummyScratchOrgAuth2.username)
          .returns({ devHubUsername: dummyDevHubUsername2 });
        defaultDevHubStub.resolves(dummyDevHubUsername1);
        getUsernameStub.resolves(dummyDevHubUsername1);
        getAllStub.returns([]);

        const authList = await orgList.filterAuthInfo(authInfoObjects);

        expect(authList[0]).to.equal('test-scratchorg1@example.com');
      });

      it('should filter the list to only show scratch orgs associated with current default dev hub with an alias', async () => {
        const authInfoObjects: OrgAuthorization[] = [
          dummyScratchOrgAuth1,
          dummyScratchOrgAuth2
        ];
        const getAuthFieldsForStub = sandbox.stub(orgList, 'getAuthFieldsFor');
        getAuthFieldsForStub.withArgs(dummyScratchOrgAuth1.username).returns({
          devHubUsername: dummyDevHubUsername1
        });
        getAuthFieldsForStub
          .withArgs(dummyScratchOrgAuth2.username)
          .returns({ devHubUsername: dummyDevHubUsername2 });
        defaultDevHubStub.returns('dev hub alias');
        getUsernameStub.resolves(dummyDevHubUsername1);
        getAllStub.returns([]);

        const authList = await orgList.filterAuthInfo(authInfoObjects);
        expect(authList[0]).to.equal(dummyScratchOrgAuth1.username);
      });

      it('should display alias with username when alias is available', async () => {
        // Arrange
        defaultDevHubStub.resolves(null);
        const authInfoObjects: OrgAuthorization[] = [
          dummyOrgAuth1,
          dummyOrgAuth2
        ];
        getAllStub.withArgs(dummyOrgAuth1.username).returns(['alias1']);
        const configUtilGetAllAliasesForStub = sandbox.stub(
          ConfigUtil,
          'getAllAliasesFor'
        );
        configUtilGetAllAliasesForStub
          .withArgs(dummyOrgAuth1.username)
          .returns(['alias1']);
        sandbox
          .stub(orgList, 'getAuthFieldsFor')
          .withArgs(authInfoObjects[0].username)
          .returns({});

        // Act
        const authList = await orgList.filterAuthInfo(authInfoObjects);

        // Assert
        expect(authList[0]).to.equal('alias1 - test-username1@example.com');
      });

      it('should flag the org as expired if expiration date has passed', async () => {
        const oneDayMillis = 60 * 60 * 24 * 1000;
        const today = new Date();
        const yesterday = new Date(today.getTime() - oneDayMillis);
        const tomorrow = new Date(today.getTime() + oneDayMillis);

        const authInfoObjects: OrgAuthorization[] = [
          getFakeOrgAuthorization({
            orgId: '000',
            username: 'test-scratchorg-today@example.com'
          }),
          getFakeOrgAuthorization({
            orgId: '111',
            username: 'test-scratchorg-yesterday@example.com'
          }),
          getFakeOrgAuthorization({
            orgId: '222',
            username: 'test-scratchorg-tomorrow@example.com'
          })
        ];

        const getAuthFieldsForStub = sandbox.stub(orgList, 'getAuthFieldsFor');
        getAuthFieldsForStub
          .withArgs('test-scratchorg-today@example.com')
          .returns({
            devHubUsername: dummyDevHubUsername1,
            expirationDate: today.toISOString().split('T')[0]
          });
        getAuthFieldsForStub
          .withArgs('test-scratchorg-yesterday@example.com')
          .returns({
            devHubUsername: dummyDevHubUsername1,
            expirationDate: yesterday.toISOString().split('T')[0]
          });
        getAuthFieldsForStub
          .withArgs('test-scratchorg-tomorrow@example.com')
          .returns({
            devHubUsername: dummyDevHubUsername1,
            expirationDate: tomorrow.toISOString().split('T')[0]
          });
        defaultDevHubStub.resolves(dummyDevHubUsername1);
        getUsernameStub.resolves(dummyDevHubUsername1);
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
        expect(
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
        expect(executeCommandStub.calledWith('sfdx.force.org.create')).to.equal(
          true
        );
      });

      it('should return Continue and call force:auth:dev:hub command if SFDX: Authorize a Dev Hub is selected', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns(
          '$(plus) ' +
            nls.localize('force_auth_web_login_authorize_dev_hub_text')
        );
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CONTINUE');
        expect(
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
        expect(
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
        expect(
          executeCommandStub.calledWith('sfdx.force.org.list.clean')
        ).to.equal(true);
      });

      it('should return Continue and call force:config:set command if a username/alias is selected', async () => {
        orgListStub.returns(orgsList);
        quickPickStub.returns('$(plus)' + orgsList[0].split(' ', 1));
        const response = await orgList.setDefaultOrg();
        expect(response.type).to.equal('CONTINUE');
        expect(executeCommandStub.calledWith('sfdx.force.config.set')).to.equal(
          true
        );
      });
    });
  });
});
