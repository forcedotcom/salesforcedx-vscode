/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, OrgAuthorization } from '@salesforce/core';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import * as orgListModule from '../../../src/orgPicker/orgList';
import * as orgUtil from '../../../src/util/orgUtil';

describe('OrgList tests', () => {
  const createOrgAuthorization = (overrides: Partial<OrgAuthorization> = {}): OrgAuthorization => ({
    orgId: '000',
    username: 'test-username@example.com',
    oauthMethod: 'unknown',
    aliases: [],
    configs: [],
    isScratchOrg: undefined,
    isDevHub: undefined,
    isSandbox: undefined,
    instanceUrl: undefined,
    accessToken: undefined,
    error: undefined,
    isExpired: false,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isOrgExpired tests', () => {
    let getAuthFieldsForMock: jest.SpyInstance;

    beforeEach(() => {
      getAuthFieldsForMock = jest.spyOn(orgUtil, 'getAuthFieldsFor');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return true when org expiration date is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      getAuthFieldsForMock.mockResolvedValueOnce({
        expirationDate: pastDate.toISOString()
      });

      const result = await orgListModule.isOrgExpired('test-org');

      expect(result).toBe(true);
      expect(getAuthFieldsForMock).toHaveBeenCalledWith('test-org');
    });

    it('should return false when org expiration date is in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      getAuthFieldsForMock.mockResolvedValueOnce({
        expirationDate: futureDate.toISOString()
      });

      const result = await orgListModule.isOrgExpired('test-org');

      expect(result).toBe(false);
      expect(getAuthFieldsForMock).toHaveBeenCalledWith('test-org');
    });

    it('should return false when org has no expiration date', async () => {
      getAuthFieldsForMock.mockResolvedValueOnce({
        expirationDate: undefined
      });

      const result = await orgListModule.isOrgExpired('test-org');

      expect(result).toBe(false);
      expect(getAuthFieldsForMock).toHaveBeenCalledWith('test-org');
    });
  });

  describe('setDefaultOrg tests', () => {
    let showQuickPickMock: jest.SpyInstance;
    let executeCommandMock: jest.SpyInstance;
    let listAllAuthorizationsMock: jest.SpyInstance;

    beforeEach(() => {
      showQuickPickMock = jest.spyOn(vscode.window, 'showQuickPick');
      executeCommandMock = jest.spyOn(vscode.commands, 'executeCommand');
      listAllAuthorizationsMock = jest.spyOn(AuthInfo, 'listAllAuthorizations');
      listAllAuthorizationsMock.mockResolvedValue([]);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('Org picker SFDX commands', () => {
      it('should handle org login web authorization selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_login_web_authorize_org_text')}`);

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.web');
      });

      it('should handle org login web dev hub authorization selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_login_web_authorize_dev_hub_text')}`);

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.web.dev.hub');
      });

      it('should handle create default scratch org selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_create_default_scratch_org_text')}`);

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.create');
      });

      it('should handle org login access token selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_login_access_token_text')}`);

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.access.token');
      });

      it('should handle org list clean selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_list_clean_text')}`);

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.list.clean');
      });

      it('should handle cancellation when no selection is made', async () => {
        showQuickPickMock.mockResolvedValueOnce(undefined);

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CANCEL' });
        expect(executeCommandMock).not.toHaveBeenCalled();
      });
    });

    it('should handle organization selection with simple alias', async () => {
      const orgAuth = createOrgAuthorization({
        username: 'user@example.com',
        aliases: ['MyOrg']
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([orgAuth]);
      const orgSelection = 'MyOrg - user@example.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'MyOrg');
    });

    it('should handle organization selection with alias containing dashes', async () => {
      const orgAuth = createOrgAuthorization({
        username: 'foo@bar.com',
        aliases: ['My Organization - Dev Sandbox']
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([orgAuth]);
      const orgSelection = 'My Organization - Dev Sandbox - foo@bar.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'My Organization - Dev Sandbox');
    });

    it('should handle organization selection with multiple dashes in alias', async () => {
      const orgAuth = createOrgAuthorization({
        username: 'admin@company.com',
        aliases: ['Sales - Force - Dev - Hub']
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([orgAuth]);
      const orgSelection = 'Sales - Force - Dev - Hub - admin@company.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'Sales - Force - Dev - Hub');
    });

    it('should handle organization selection with no alias (just username)', async () => {
      const orgAuth = createOrgAuthorization({
        username: 'user@example.com',
        aliases: []
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([orgAuth]);
      const orgSelection = 'user@example.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'user@example.com');
    });

    it('should handle organization selection with comma-separated aliases', async () => {
      const orgAuth = createOrgAuthorization({
        username: 'user@example.com',
        aliases: ['alias1', 'alias2', 'alias3']
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([orgAuth]);
      const orgSelection = 'alias1,alias2,alias3 - user@example.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'alias1,alias2,alias3');
    });

    it('should filter out expired orgs from the list', async () => {
      const expiredOrg = createOrgAuthorization({
        username: 'expired@example.com',
        aliases: ['ExpiredOrg'],
        isExpired: true
      });
      const activeOrg = createOrgAuthorization({
        username: 'active@example.com',
        aliases: ['ActiveOrg'],
        isExpired: false
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([expiredOrg, activeOrg]);
      const orgSelection = 'ActiveOrg - active@example.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(showQuickPickMock).toHaveBeenCalledWith(
        expect.arrayContaining(['ActiveOrg - active@example.com']),
        expect.any(Object)
      );
      expect(showQuickPickMock).toHaveBeenCalledWith(
        expect.not.arrayContaining(['ExpiredOrg - expired@example.com']),
        expect.any(Object)
      );
    });
  });
});
