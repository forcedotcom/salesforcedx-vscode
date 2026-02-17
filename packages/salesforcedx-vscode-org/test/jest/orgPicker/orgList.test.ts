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
    let getDefaultOrgConfigurationMock: jest.SpyInstance;

    const defaultConfig = {
      defaultDevHubProperty: undefined,
      defaultOrgProperty: undefined,
      defaultDevHubUsername: undefined,
      defaultOrgUsername: undefined
    };

    beforeEach(() => {
      showQuickPickMock = jest.spyOn(vscode.window, 'showQuickPick');
      executeCommandMock = jest.spyOn(vscode.commands, 'executeCommand');
      listAllAuthorizationsMock = jest.spyOn(AuthInfo, 'listAllAuthorizations');
      getDefaultOrgConfigurationMock = jest.spyOn(orgUtil, 'getDefaultOrgConfiguration');
      listAllAuthorizationsMock.mockResolvedValue([]);
      getDefaultOrgConfigurationMock.mockResolvedValue(defaultConfig);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('Org picker SFDX commands', () => {
      it('should handle org login web authorization selection', async () => {
        showQuickPickMock.mockResolvedValueOnce({
          label: `$(plus) ${nls.localize('org_login_web_authorize_org_text')}`,
          commandId: 'sf.org.login.web'
        });

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.web');
      });

      it('should handle org login web dev hub authorization selection', async () => {
        showQuickPickMock.mockResolvedValueOnce({
          label: `$(plus) ${nls.localize('org_login_web_authorize_dev_hub_text')}`,
          commandId: 'sf.org.login.web.dev.hub'
        });

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.web.dev.hub');
      });

      it('should handle create default scratch org selection', async () => {
        showQuickPickMock.mockResolvedValueOnce({
          label: `$(plus) ${nls.localize('org_create_default_scratch_org_text')}`,
          commandId: 'sf.org.create'
        });

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.create');
      });

      it('should handle org login access token selection', async () => {
        showQuickPickMock.mockResolvedValueOnce({
          label: `$(plus) ${nls.localize('org_login_access_token_text')}`,
          commandId: 'sf.org.login.access.token'
        });

        const result = await orgListModule.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.access.token');
      });

      it('should handle org list clean selection', async () => {
        showQuickPickMock.mockResolvedValueOnce({
          label: `$(plus) ${nls.localize('org_list_clean_text')}`,
          commandId: 'sf.org.list.clean'
        });

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
      showQuickPickMock.mockImplementationOnce(items => {
        const orgItem = (items as orgListModule.OrgQuickPickItem[]).find(item => item.orgUsername);
        expect(orgItem!.label).toContain('MyOrg');
        expect(orgItem!.label).toContain('user@example.com');
        expect(orgItem!.label).toMatch(/\| .* \| /);
        return Promise.resolve(orgItem!);
      });

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'MyOrg');
    });

    it('should handle organization selection with alias containing dashes', async () => {
      const orgAuth = createOrgAuthorization({
        username: 'foo@bar.com',
        aliases: ['My Organization - Dev Sandbox'],
        isSandbox: true
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([orgAuth]);
      showQuickPickMock.mockImplementationOnce(items => {
        const orgItem = (items as orgListModule.OrgQuickPickItem[]).find(item => item.orgUsername);
        expect(orgItem!.label).toContain('My Organization - Dev Sandbox');
        expect(orgItem!.label).toContain('foo@bar.com');
        return Promise.resolve(orgItem!);
      });

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'My Organization - Dev Sandbox');
    });

    it('should handle organization selection with multiple dashes in alias', async () => {
      const orgAuth = createOrgAuthorization({
        username: 'admin@company.com',
        aliases: ['Sales - Force - Dev - Hub'],
        isDevHub: true
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([orgAuth]);
      showQuickPickMock.mockImplementationOnce(items => {
        const orgItem = (items as orgListModule.OrgQuickPickItem[]).find(item => item.orgUsername);
        expect(orgItem!.label).toContain('Sales - Force - Dev - Hub');
        expect(orgItem!.label).toContain('admin@company.com');
        return Promise.resolve(orgItem!);
      });

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
      showQuickPickMock.mockImplementationOnce(items => {
        const orgItem = (items as orgListModule.OrgQuickPickItem[]).find(item => item.orgUsername);
        expect(orgItem!.label).toBe('$(cloud) | user@example.com');
        expect(orgItem!.orgAlias).toBeUndefined();
        return Promise.resolve(orgItem!);
      });

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
      showQuickPickMock.mockImplementationOnce(items => {
        const orgItem = (items as orgListModule.OrgQuickPickItem[]).find(item => item.orgUsername);
        expect(orgItem!.label).toContain('alias1, alias2, alias3');
        expect(orgItem!.label).toContain('user@example.com');
        expect(orgItem!.orgAlias).toBe('alias1');
        return Promise.resolve(orgItem!);
      });

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'alias1');
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
      showQuickPickMock.mockImplementationOnce(items => {
        const orgItems = (items as orgListModule.OrgQuickPickItem[]).filter(item => item.orgUsername);
        expect(orgItems).toHaveLength(1);
        expect(orgItems[0].orgUsername).toBe('active@example.com');
        expect(orgItems[0].orgAlias).toBe('ActiveOrg');
        return Promise.resolve(orgItems[0]);
      });

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'ActiveOrg');
    });

    it('should sort orgs: Scratch, Sandbox, Other, DevHub, Defaults; alphabetical within each', async () => {
      const defaultOrg = createOrgAuthorization({
        username: 'default@example.com',
        aliases: ['DefaultOrg'],
        isDevHub: true
      });
      const scratchOrg = createOrgAuthorization({
        username: 'scratch@example.com',
        aliases: ['ScratchOrg'],
        isScratchOrg: true
      });
      const sandboxOrg = createOrgAuthorization({
        username: 'sandbox@example.com',
        aliases: ['SandboxOrg'],
        isSandbox: true
      });
      const regularOrg = createOrgAuthorization({
        username: 'regular@example.com',
        aliases: ['RegularOrg'],
        isDevHub: false,
        isSandbox: false,
        isScratchOrg: false
      });
      const devHubOrg = createOrgAuthorization({
        username: 'devhub@example.com',
        aliases: ['DevHubOrg'],
        isDevHub: true
      });
      getDefaultOrgConfigurationMock.mockResolvedValueOnce({
        defaultDevHubProperty: 'DefaultOrg',
        defaultOrgProperty: 'DefaultOrg',
        defaultDevHubUsername: 'default@example.com',
        defaultOrgUsername: 'default@example.com'
      });
      listAllAuthorizationsMock.mockResolvedValueOnce([
        defaultOrg,
        scratchOrg,
        sandboxOrg,
        regularOrg,
        devHubOrg
      ]);
      showQuickPickMock.mockImplementationOnce(items => {
        const orgItems = (items as orgListModule.OrgQuickPickItem[]).filter(item => item.orgUsername);
        expect(orgItems[0].orgAlias).toBe('ScratchOrg');
        expect(orgItems[1].orgAlias).toBe('SandboxOrg');
        expect(orgItems[2].orgAlias).toBe('RegularOrg');
        expect(orgItems[3].orgAlias).toBe('DevHubOrg');
        expect(orgItems[4].orgAlias).toBe('DefaultOrg');
        return Promise.resolve(orgItems[0]);
      });

      const result = await orgListModule.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
    });
  });
});
