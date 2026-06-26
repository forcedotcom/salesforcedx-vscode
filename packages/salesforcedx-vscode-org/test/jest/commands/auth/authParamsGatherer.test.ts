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
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import {
  AccessTokenParamsGatherer,
  AuthParamsGatherer,
  DEFAULT_ALIAS,
  ScratchOrgLogoutParamsGatherer
} from '../../../../src/commands/auth/authParamsGatherer';
import { resetOrgRuntimeForTesting, setAllServicesLayer } from '../../../../src/extensionProvider';
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

  beforeEach(() => {
    useLayer();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('programmatic instance URL (access-token re-auth flow)', () => {
    const instanceUrl = 'https://demo.my.salesforce.com';

    it('uses reauthAliasOrUsername for --alias when provided', async () => {
      const gatherer = new AuthParamsGatherer(instanceUrl, 'demoOrg');
      const result = await gatherer.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { alias: 'demoOrg', loginUrl: instanceUrl }
      });
    });

    it('trims reauthAliasOrUsername', async () => {
      const gatherer = new AuthParamsGatherer(instanceUrl, '  demoOrg  ');
      const result = await gatherer.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { alias: 'demoOrg', loginUrl: instanceUrl }
      });
    });

    it('falls back to reauth-{DEFAULT_ALIAS} when reauthAliasOrUsername is omitted', async () => {
      const gatherer = new AuthParamsGatherer(instanceUrl);
      const result = await gatherer.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { alias: `reauth-${DEFAULT_ALIAS}`, loginUrl: instanceUrl }
      });
    });

    it('falls back to reauth-{DEFAULT_ALIAS} when reauthAliasOrUsername is blank', async () => {
      const gatherer = new AuthParamsGatherer(instanceUrl, '   ');
      const result = await gatherer.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { alias: `reauth-${DEFAULT_ALIAS}`, loginUrl: instanceUrl }
      });
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

      const result = await new AccessTokenParamsGatherer().gather();

      expect(result).toEqual({ type: 'CONTINUE', data: { alias: 'myAlias', instanceUrl, accessToken } });
    });

    it('empty-string alias defaults to DEFAULT_ALIAS', async () => {
      jest
        .spyOn(vscode.window, 'showInputBox')
        .mockResolvedValueOnce(instanceUrl)
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(accessToken);

      const result = await new AccessTokenParamsGatherer().gather();

      expect(result).toEqual({ type: 'CONTINUE', data: { alias: DEFAULT_ALIAS, instanceUrl, accessToken } });
    });

    it('CANCEL when instance URL prompt is dismissed (undefined)', async () => {
      jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(undefined);

      const result = await new AccessTokenParamsGatherer().gather();

      expect(result).toEqual({ type: 'CANCEL' });
    });

    it('CANCEL when alias prompt is dismissed (undefined)', async () => {
      jest.spyOn(vscode.window, 'showInputBox').mockResolvedValueOnce(instanceUrl).mockResolvedValueOnce(undefined);

      const result = await new AccessTokenParamsGatherer().gather();

      expect(result).toEqual({ type: 'CANCEL' });
    });
  });

  describe('ScratchOrgLogoutParamsGatherer', () => {
    it('CONTINUE with the username when confirmed', async () => {
      useLayer(true);
      const result = await new ScratchOrgLogoutParamsGatherer('user@example.com', 'myScratch').gather();
      expect(result).toEqual({ type: 'CONTINUE', data: 'user@example.com' });
    });

    it('CANCEL when the confirmation is dismissed', async () => {
      useLayer(false);
      const result = await new ScratchOrgLogoutParamsGatherer('user@example.com', 'myScratch').gather();
      expect(result).toEqual({ type: 'CANCEL' });
    });
  });
});
