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
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
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
  const buildLayer = (confirm = true) => {
    const mockServicesApi = {
      services: {
        // PromptService has accessors:false, so consumers `yield*` the service first
        PromptService: Effect.succeed({ considerUndefinedAsCancellation, confirmOrThrow: makeConfirmOrThrow(confirm) }),
        UserCancellationError
      }
    } as unknown as SalesforceVSCodeServicesApi;
    return Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
  };

  const useLayer = (confirm = true): void => {
    resetOrgRuntimeForTesting();
    setAllServicesLayer(
      buildLayer(confirm) as ReturnType<typeof import('@salesforce/effect-ext-utils').buildAllServicesLayer>
    );
  };

  const failureTag = (exit: Exit.Exit<unknown, unknown>): string | undefined =>
    Exit.isFailure(exit)
      ? Option.match(Cause.failureOption(exit.cause), {
          onNone: () => undefined,
          onSome: error => (error as { _tag?: string })._tag
        })
      : undefined;

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

      expect(failureTag(exit)).toBe('UserCancellationError');
    });

    it('cancels with UserCancellationError when alias prompt is dismissed (undefined)', async () => {
      jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(instanceUrl).mockResolvedValueOnce(undefined);

      const exit = await getOrgRuntime().runPromiseExit(gatherAccessTokenParams());

      expect(failureTag(exit)).toBe('UserCancellationError');
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

      // second prompt = alias: rejects shell metachars, accepts alphanumeric and empty (use default)
      const validateAlias = spy.mock.calls[1][0]?.validateInput?.bind(undefined);
      expect(validateAlias?.('bad;alias')).toBe(nls.localize('error_invalid_org_alias'));
      expect(validateAlias?.('GoodAlias')).toBeUndefined();
      expect(validateAlias?.('')).toBeUndefined();
    });
  });
});
