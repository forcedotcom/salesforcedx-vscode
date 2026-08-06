/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ExtensionProviderService,
  type ExtensionProviderService as ExtensionProviderServiceType
} from '@salesforce/effect-ext-utils';
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import {
  DEFAULT_ALIAS,
  gatherAccessTokenParams,
  gatherAuthParams
} from '../../../../src/commands/auth/authParamsGatherer';
import { getOrgRuntime, resetOrgRuntimeForTesting, setAllServicesLayer } from '../../../../src/extensionProvider';
import { nls } from '../../../../src/messages';
import {
  considerUndefinedAsCancellation,
  makeConfirmOrThrow,
  UserCancellationError
} from '../../testHelpers/promptServiceStub';

describe('AuthParamsGatherer', () => {
  const buildLayer = (confirm = true, projectLoginUrl?: string) => {
    const mockServicesApi = {
      services: {
        // PromptService has accessors:false, so consumers `yield*` the service first
        PromptService: Effect.succeed({ considerUndefinedAsCancellation, confirmOrThrow: makeConfirmOrThrow(confirm) }),
        ProjectService: {
          getSfProject: () =>
            Effect.succeed({
              retrieveSfProjectJson: () => Promise.resolve({ get: () => projectLoginUrl })
            })
        },
        UserCancellationError
      }
    } as unknown as SalesforceVSCodeServicesApi;
    return Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
  };

  const useLayer = (confirm = true, projectLoginUrl?: string): void => {
    resetOrgRuntimeForTesting();
    setAllServicesLayer(
      buildLayer(confirm, projectLoginUrl) as ReturnType<
        typeof import('@salesforce/effect-ext-utils').buildAllServicesLayer
      >
    );
  };

  beforeEach(() => {
    useLayer();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('programmatic instance URL (access-token re-auth flow)', () => {
    const instanceUrl = 'https://demo.my.salesforce.com';

    it('uses reauthAliasOrUsername for --alias when provided', async () => {
      const exit = await getOrgRuntime().runPromiseExit(
        gatherAuthParams({ instanceUrl, reauthAliasOrUsername: 'demoOrg' })
      );
      expect(exit).toStrictEqual(Exit.succeed({ alias: 'demoOrg', loginUrl: instanceUrl }));
    });

    it('trims reauthAliasOrUsername', async () => {
      const exit = await getOrgRuntime().runPromiseExit(
        gatherAuthParams({ instanceUrl, reauthAliasOrUsername: '  demoOrg  ' })
      );
      expect(exit).toStrictEqual(Exit.succeed({ alias: 'demoOrg', loginUrl: instanceUrl }));
    });

    it('falls back to reauth-{DEFAULT_ALIAS} when reauthAliasOrUsername is omitted', async () => {
      const exit = await getOrgRuntime().runPromiseExit(
        gatherAuthParams({ instanceUrl, reauthAliasOrUsername: undefined })
      );
      expect(exit).toStrictEqual(Exit.succeed({ alias: `reauth-${DEFAULT_ALIAS}`, loginUrl: instanceUrl }));
    });

    it('falls back to reauth-{DEFAULT_ALIAS} when reauthAliasOrUsername is blank', async () => {
      const exit = await getOrgRuntime().runPromiseExit(
        gatherAuthParams({ instanceUrl, reauthAliasOrUsername: '   ' })
      );
      expect(exit).toStrictEqual(Exit.succeed({ alias: `reauth-${DEFAULT_ALIAS}`, loginUrl: instanceUrl }));
    });
  });

  describe('project default instance URL', () => {
    const gatherFromPicker = async (projectLoginUrl?: string) => {
      useLayer(true, projectLoginUrl);
      jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue('myAlias');
      const quickPick = jest.spyOn(vscode.window, 'showQuickPick').mockImplementation(async items => {
        const choices = await items;
        return choices.find(choice => choice.label === nls.localize('auth_project_label')) ?? choices[0];
      });

      const exit = await getOrgRuntime().runPromiseExit(
        gatherAuthParams({ instanceUrl: undefined, reauthAliasOrUsername: undefined })
      );
      return { exit, choices: await quickPick.mock.calls[0][0] };
    };

    it.each([
      ['https://example.com', 'https://example.com/'],
      ['http://example.com:8080/login', 'http://example.com:8080/login']
    ])('normalizes a valid %s project URL', async (projectLoginUrl, expected) => {
      const warning = jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);

      const { exit, choices } = await gatherFromPicker(projectLoginUrl);

      expect(exit).toStrictEqual(Exit.succeed({ alias: 'myAlias', loginUrl: expected }));
      expect(choices).toContainEqual(
        expect.objectContaining({
          label: nls.localize('auth_project_label'),
          detail: `${nls.localize('auth_project_detail')} (${expected})`
        })
      );
      expect(warning).not.toHaveBeenCalled();
    });

    it.each(['not a URL', 'ftp://example.com', 'https://example.com; touch /tmp/pwned'])(
      'warns and omits an invalid project URL: %s',
      async projectLoginUrl => {
        const warning = jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);

        const { exit, choices } = await gatherFromPicker(projectLoginUrl);

        expect(exit).toStrictEqual(Exit.succeed({ alias: 'myAlias', loginUrl: 'https://login.salesforce.com' }));
        expect(choices).not.toContainEqual(expect.objectContaining({ label: nls.localize('auth_project_label') }));
        expect(warning).toHaveBeenCalledWith(nls.localize('auth_invalid_project_url', projectLoginUrl));
      }
    );

    it('offers safe choices without warning when sfdcLoginUrl is absent', async () => {
      const warning = jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);

      const { exit, choices } = await gatherFromPicker();

      expect(exit).toStrictEqual(Exit.succeed({ alias: 'myAlias', loginUrl: 'https://login.salesforce.com' }));
      expect(choices).toHaveLength(3);
      expect(choices).not.toContainEqual(expect.objectContaining({ label: nls.localize('auth_project_label') }));
      expect(warning).not.toHaveBeenCalled();
    });
  });

  describe('AccessTokenParamsGatherer', () => {
    const instanceUrl = 'https://demo.my.salesforce.com';
    const accessToken = 'token123';

    it('CONTINUE happy path with explicit alias', async () => {
      jest
        .spyOn(vscode.window, 'showInputBox')
        .mockResolvedValueOnce(instanceUrl)
        .mockResolvedValueOnce('myAlias')
        .mockResolvedValueOnce(accessToken);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(exit).toStrictEqual(Exit.succeed({ alias: 'myAlias', instanceUrl, accessToken }));
    });

    it('empty-string alias defaults to DEFAULT_ALIAS', async () => {
      jest
        .spyOn(vscode.window, 'showInputBox')
        .mockResolvedValueOnce(instanceUrl)
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(accessToken);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(exit).toStrictEqual(Exit.succeed({ alias: DEFAULT_ALIAS, instanceUrl, accessToken }));
    });

    it('cancels with UserCancellationError when instance URL prompt is dismissed (undefined)', async () => {
      jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(undefined);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    });

    it('cancels with UserCancellationError when alias prompt is dismissed (undefined)', async () => {
      jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(instanceUrl).mockResolvedValueOnce(undefined);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    });

    it('wires validateInput on the instance-url and alias prompts', async () => {
      const spy = jest
        .spyOn(vscode.window, 'showInputBox')
        .mockResolvedValueOnce(instanceUrl)
        .mockResolvedValueOnce('myAlias')
        .mockResolvedValueOnce(accessToken);

      await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      // first prompt = instance URL: rejects shell metachars, accepts a valid https url
      const validateUrl = spy.mock.calls[0][0]?.validateInput?.bind(undefined);
      expect(validateUrl?.('https://x.com; touch /tmp/pwned')).toBe(nls.localize('auth_invalid_url'));
      expect(validateUrl?.('https://my.salesforce.com')).toBeUndefined();
      expect(validateUrl?.('http://localhost:1717/oauth/callback')).toBeUndefined();
      expect(validateUrl?.('ftp://my.salesforce.com')).toBe(nls.localize('auth_invalid_url'));
      expect(validateUrl?.('https://my.salesforce.com/path?query=value')).toBe(nls.localize('auth_invalid_url'));

      // second prompt = alias: rejects shell metachars, accepts alphanumeric, hyphens, and empty (use default)
      const validateAlias = spy.mock.calls[1][0]?.validateInput?.bind(undefined);
      expect(validateAlias?.('bad;alias')).toBe(nls.localize('error_invalid_org_alias'));
      expect(validateAlias?.('GoodAlias')).toBeUndefined();
      expect(validateAlias?.('my-scratch-org')).toBeUndefined();
      expect(validateAlias?.('')).toBeUndefined();
    });
  });
});
