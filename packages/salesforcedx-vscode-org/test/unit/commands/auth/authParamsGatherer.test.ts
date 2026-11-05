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
import {
  type buildAllServicesLayer,
  getOrgRuntime,
  resetOrgRuntimeForTesting,
  setAllServicesLayer
} from '../../../../src/extensionProvider';
import { nls } from '../../../../src/messages';
import { considerUndefinedAsCancellation, makeConfirmOrThrow } from '../../testHelpers/promptServiceStub';
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';

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
        NotificationModeService: Effect.succeed({
          getProgressLocation: () => Effect.succeed(1),
          showSuccessNotification: () => Effect.void
        }),
        UserCancellationError
      }
    } as unknown as SalesforceVSCodeServicesApi;
    return Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
  };

  const useLayer = (confirm = true, projectLoginUrl?: string): void => {
    resetOrgRuntimeForTesting();
    setAllServicesLayer(buildLayer(confirm, projectLoginUrl) as ReturnType<typeof buildAllServicesLayer>);
  };

  beforeEach(() => {
    useLayer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('myAlias');
      const quickPick = vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async items => {
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
      const warning = vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);

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
        const warning = vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);

        const { exit, choices } = await gatherFromPicker(projectLoginUrl);

        expect(exit).toStrictEqual(Exit.succeed({ alias: 'myAlias', loginUrl: 'https://login.salesforce.com' }));
        expect(choices).not.toContainEqual(expect.objectContaining({ label: nls.localize('auth_project_label') }));
        expect(warning).toHaveBeenCalledWith(nls.localize('auth_invalid_project_url', projectLoginUrl));
      }
    );

    it('offers safe choices without warning when sfdcLoginUrl is absent', async () => {
      const warning = vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined);

      const { exit, choices } = await gatherFromPicker();

      expect(exit).toStrictEqual(Exit.succeed({ alias: 'myAlias', loginUrl: 'https://login.salesforce.com' }));
      expect(choices).toHaveLength(3);
      expect(choices).not.toContainEqual(expect.objectContaining({ label: nls.localize('auth_project_label') }));
      expect(warning).not.toHaveBeenCalled();
    });
  });

  describe('AccessTokenParamsGatherer', () => {
    const instanceUrl = 'https://demo.my.salesforce.com';
    const accessToken = '00D000000000000!AQE-plant=+abc123';

    it('CONTINUE happy path with explicit alias', async () => {
      vi.spyOn(vscode.window, 'showInputBox')
        .mockResolvedValueOnce(instanceUrl)
        .mockResolvedValueOnce('myAlias')
        .mockResolvedValueOnce(accessToken);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(exit).toStrictEqual(Exit.succeed({ alias: 'myAlias', instanceUrl, accessToken }));
    });

    it('empty-string alias defaults to DEFAULT_ALIAS', async () => {
      vi.spyOn(vscode.window, 'showInputBox')
        .mockResolvedValueOnce(instanceUrl)
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(accessToken);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(exit).toStrictEqual(Exit.succeed({ alias: DEFAULT_ALIAS, instanceUrl, accessToken }));
    });

    it('cancels with UserCancellationError when instance URL prompt is dismissed (undefined)', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(undefined);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    });

    it('cancels with UserCancellationError when alias prompt is dismissed (undefined)', async () => {
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(instanceUrl).mockResolvedValueOnce(undefined);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toContain('UserCancellationError');
    });

    it('validates the instance URL, alias, and Salesforce session ID prompts', async () => {
      const spy = vi
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
      // This passes the safe-character pattern but fails the URL transformation.
      expect(validateUrl?.('https://my.salesforce.com:99999')).toBe(nls.localize('auth_invalid_url'));
      expect(validateUrl?.('')).toBe(nls.localize('auth_invalid_url'));

      // second prompt = alias: rejects shell metachars, accepts alphanumeric, hyphens, and empty (use default)
      const validateAlias = spy.mock.calls[1][0]?.validateInput?.bind(undefined);
      expect(validateAlias?.('bad;alias')).toBe(nls.localize('error_invalid_org_alias'));
      expect(validateAlias?.('GoodAlias')).toBeUndefined();
      expect(validateAlias?.('my-scratch-org')).toBeUndefined();
      expect(validateAlias?.('')).toBeUndefined();

      const validateAccessToken = spy.mock.calls[2][0]?.validateInput?.bind(undefined);
      expect(validateAccessToken?.(accessToken)).toBeUndefined();
      expect(validateAccessToken?.('00D000000000000AAA!AQ-1=')).toBeUndefined();
      expect(validateAccessToken?.('token123')).toBe(
        nls.localize('parameter_gatherer_enter_session_id_diagnostic_message')
      );
      expect(validateAccessToken?.('04t000000000000!AQ-1=')).toBe(
        nls.localize('parameter_gatherer_enter_session_id_diagnostic_message')
      );
      expect(validateAccessToken?.('00D000000000000!token with spaces')).toBe(
        nls.localize('parameter_gatherer_enter_session_id_diagnostic_message')
      );
    });
  });

  it('uses the same inline URL validation for custom web-login URLs', async () => {
    vi.spyOn(vscode.window, 'showQuickPick').mockImplementation(async items =>
      (await items).find(choice => choice.label === nls.localize('auth_custom_label'))
    );
    const input = vi
      .spyOn(vscode.window, 'showInputBox')
      .mockResolvedValueOnce('http://localhost:1717/login')
      .mockResolvedValueOnce('');

    expect(
      await getOrgRuntime().runPromiseExit(
        gatherAuthParams({ instanceUrl: undefined, reauthAliasOrUsername: undefined })
      )
    ).toStrictEqual(Exit.succeed({ alias: DEFAULT_ALIAS, loginUrl: 'http://localhost:1717/login' }));
    const validate = input.mock.calls[0][0]?.validateInput?.bind(undefined);
    expect(validate?.('')).toBe(nls.localize('auth_invalid_url'));
    expect(validate?.('https://example.com:99999')).toBe(nls.localize('auth_invalid_url'));
    expect(validate?.('http://localhost:1717/login')).toBeUndefined();
  });
});
