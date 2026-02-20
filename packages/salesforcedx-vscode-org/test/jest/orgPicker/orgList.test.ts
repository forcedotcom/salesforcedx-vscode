/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, OrgAuthorization } from '@salesforce/core';
import { ICONS } from 'salesforcedx-vscode-media';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import * as orgListModule from '../../../src/orgPicker/orgList';
import { authorizationsToQuickPickItems } from '../../../src/orgPicker/orgList';
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

  describe('mocks', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.restoreAllMocks();
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
            label: `${ICONS.ADD} ${nls.localize('org_login_web_authorize_org_text')}`,
            commandId: 'sf.org.login.web'
          });

          const result = await orgListModule.setDefaultOrg();

          expect(result).toEqual({ type: 'CONTINUE', data: {} });
          expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.web');
        });

        it('should handle org login web dev hub authorization selection', async () => {
          showQuickPickMock.mockResolvedValueOnce({
            label: `${ICONS.ADD} ${nls.localize('org_login_web_authorize_dev_hub_text')}`,
            commandId: 'sf.org.login.web.dev.hub'
          });

          const result = await orgListModule.setDefaultOrg();

          expect(result).toEqual({ type: 'CONTINUE', data: {} });
          expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.web.dev.hub');
        });

        it('should handle create default scratch org selection', async () => {
          showQuickPickMock.mockResolvedValueOnce({
            label: `${ICONS.ADD} ${nls.localize('org_create_default_scratch_org_text')}`,
            commandId: 'sf.org.create'
          });

          const result = await orgListModule.setDefaultOrg();

          expect(result).toEqual({ type: 'CONTINUE', data: {} });
          expect(executeCommandMock).toHaveBeenCalledWith('sf.org.create');
        });

        it('should handle org login access token selection', async () => {
          showQuickPickMock.mockResolvedValueOnce({
            label: `${ICONS.ADD} ${nls.localize('org_login_access_token_text')}`,
            commandId: 'sf.org.login.access.token'
          });

          const result = await orgListModule.setDefaultOrg();

          expect(result).toEqual({ type: 'CONTINUE', data: {} });
          expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.access.token');
        });

        it('should handle org list clean selection', async () => {
          showQuickPickMock.mockResolvedValueOnce({
            label: `${ICONS.ADD} ${nls.localize('org_list_clean_text')}`,
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
    });
  });

  describe('authorizationsToQuickPickItems', () => {
    const defaultConfig = {
      defaultDevHubProperty: undefined,
      defaultOrgProperty: undefined,
      defaultDevHubUsername: undefined,
      defaultOrgUsername: undefined
    };

    const defaultConfigWithDefaults = {
      defaultDevHubProperty: 'DefaultOrg' as const,
      defaultOrgProperty: 'DefaultOrg' as const,
      defaultDevHubUsername: 'default@example.com' as const,
      defaultOrgUsername: 'default@example.com' as const
    };

    describe('sort/filter tests', () => {
      it('filters out expired orgs', () => {
        const authorizations = [
          createOrgAuthorization({ username: 'expired@example.com', aliases: ['ExpiredOrg'], isExpired: true }),
          createOrgAuthorization({ username: 'active@example.com', aliases: ['ActiveOrg'], isExpired: false })
        ];
        const items = authorizationsToQuickPickItems(authorizations, defaultConfig);
        expect(items).toHaveLength(1);
        expect(items[0].orgUsername).toBe('active@example.com');
        expect(items[0].orgAlias).toBe('ActiveOrg');
      });

      it('sorts orgs: Scratch, Sandbox, Other, DevHub, Defaults; alphabetical within each', () => {
        const authorizations = [
          createOrgAuthorization({ username: 'default@example.com', aliases: ['DefaultOrg'], isDevHub: true }),
          createOrgAuthorization({ username: 'scratch@example.com', aliases: ['ScratchOrg'], isScratchOrg: true }),
          createOrgAuthorization({ username: 'sandbox@example.com', aliases: ['SandboxOrg'], isSandbox: true }),
          createOrgAuthorization({
            username: 'regular@example.com',
            aliases: ['RegularOrg'],
            isDevHub: false,
            isSandbox: false,
            isScratchOrg: false
          }),
          createOrgAuthorization({ username: 'devhub@example.com', aliases: ['DevHubOrg'], isDevHub: true })
        ];
        const items = authorizationsToQuickPickItems(authorizations, defaultConfigWithDefaults);
        expect(items.map(i => i.orgAlias)).toEqual([
          'ScratchOrg',
          'SandboxOrg',
          'RegularOrg',
          'DefaultOrg',
          'DevHubOrg'
        ]);
      });

      it('puts orgs with aliases before those without within each type', () => {
        const authorizations = [
          createOrgAuthorization({ username: 'a@example.com', aliases: [], isSandbox: true }),
          createOrgAuthorization({ username: 'b@example.com', aliases: ['SandboxB'], isSandbox: true })
        ];
        const items = authorizationsToQuickPickItems(authorizations, defaultConfig);
        expect(items[0].orgAlias).toBe('SandboxB');
        expect(items[1].orgAlias).toBeUndefined();
      });
    });

    describe('snapshot tests', () => {
      it('no alias: label, orgAlias undefined, sf.config.set receives orgUsername', () => {
        const items = authorizationsToQuickPickItems(
          [createOrgAuthorization({ username: 'user@example.com', aliases: [] })],
          defaultConfig
        );
        expect(items).toMatchInlineSnapshot(`
[
  {
    "description": undefined,
    "label": "$(cloud) user@example.com",
    "orgAlias": undefined,
    "orgType": "Org",
    "orgUsername": "user@example.com",
  },
]
`);
      });

      it('simple alias: label, sf.config.set receives orgAlias', () => {
        const items = authorizationsToQuickPickItems(
          [createOrgAuthorization({ username: 'user@example.com', aliases: ['MyOrg'] })],
          defaultConfig
        );
        expect(items).toMatchInlineSnapshot(`
[
  {
    "description": "user@example.com",
    "label": "$(cloud) MyOrg",
    "orgAlias": "MyOrg",
    "orgType": "Org",
    "orgUsername": "user@example.com",
  },
]
`);
      });

      it('alias with dashes: label, sf.config.set receives orgAlias', () => {
        const items = authorizationsToQuickPickItems(
          [
            createOrgAuthorization({
              username: 'foo@bar.com',
              aliases: ['My Organization - Dev Sandbox'],
              isSandbox: true
            })
          ],
          defaultConfig
        );
        expect(items).toMatchInlineSnapshot(`
[
  {
    "description": "foo@bar.com",
    "label": "$(beaker) My Organization - Dev Sandbox",
    "orgAlias": "My Organization - Dev Sandbox",
    "orgType": "Sandbox",
    "orgUsername": "foo@bar.com",
  },
]
`);
      });

      it('alias with multiple dashes (DevHub): label, sf.config.set receives orgAlias', () => {
        const items = authorizationsToQuickPickItems(
          [
            createOrgAuthorization({
              username: 'admin@company.com',
              aliases: ['Sales - Force - Dev - Hub'],
              isDevHub: true
            })
          ],
          defaultConfig
        );
        expect(items).toMatchInlineSnapshot(`
[
  {
    "description": "admin@company.com",
    "label": "$(server) Sales - Force - Dev - Hub",
    "orgAlias": "Sales - Force - Dev - Hub",
    "orgType": "DevHub",
    "orgUsername": "admin@company.com",
  },
]
`);
      });

      it('default org with alias: description has username then default suffix', () => {
        const items = authorizationsToQuickPickItems(
          [createOrgAuthorization({ username: 'user@example.com', aliases: ['MyOrg'] })],
          { ...defaultConfig, defaultOrgProperty: 'MyOrg', defaultOrgUsername: 'user@example.com' }
        );
        expect(items[0].label).toContain('MyOrg');
        expect(items[0].description).toBe(`user@example.com — Default Org ${ICONS.SF_DEFAULT_ORG}`);
      });

      it('default devhub with alias: description has username then default suffix', () => {
        const items = authorizationsToQuickPickItems(
          [createOrgAuthorization({ username: 'hub@example.com', aliases: ['Hub'], isDevHub: true })],
          { ...defaultConfig, defaultDevHubProperty: 'Hub', defaultDevHubUsername: 'hub@example.com' }
        );
        expect(items[0].label).toContain('Hub');
        expect(items[0].description).toBe(`hub@example.com — Default Dev Hub ${ICONS.SF_DEFAULT_HUB}`);
      });

      it('default org without alias: description is just default suffix', () => {
        const items = authorizationsToQuickPickItems(
          [createOrgAuthorization({ username: 'user@example.com', aliases: [] })],
          { ...defaultConfig, defaultOrgProperty: 'user@example.com', defaultOrgUsername: 'user@example.com' }
        );
        expect(items[0].label).toContain('user@example.com');
        expect(items[0].description).toBe(`Default Org ${ICONS.SF_DEFAULT_ORG}`);
      });

      it('org that is both default org and default devhub gets combined description', () => {
        const items = authorizationsToQuickPickItems(
          [createOrgAuthorization({ username: 'both@example.com', aliases: ['Both'], isDevHub: true })],
          {
            defaultOrgProperty: 'Both',
            defaultOrgUsername: 'both@example.com',
            defaultDevHubProperty: 'Both',
            defaultDevHubUsername: 'both@example.com'
          }
        );
        expect(items[0].label).toContain('Both');
        expect(items[0].description).toBe(
          `both@example.com — Default Org ${ICONS.SF_DEFAULT_ORG} · Default Dev Hub ${ICONS.SF_DEFAULT_HUB}`
        );
      });

      it('comma-separated aliases: label, orgAlias first, sf.config.set receives orgAlias', () => {
        const items = authorizationsToQuickPickItems(
          [createOrgAuthorization({ username: 'user@example.com', aliases: ['alias1', 'alias2', 'alias3'] })],
          defaultConfig
        );
        expect(items).toMatchInlineSnapshot(`
[
  {
    "description": "user@example.com",
    "label": "$(cloud) alias1, alias2, alias3",
    "orgAlias": "alias1",
    "orgType": "Org",
    "orgUsername": "user@example.com",
  },
]
`);
      });
    });
  });
});
