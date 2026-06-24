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
import { AuthParamsGatherer, DEFAULT_ALIAS } from '../../../../src/commands/auth/authParamsGatherer';
import { resetOrgRuntimeForTesting, setAllServicesLayer } from '../../../../src/extensionProvider';

/** Cancels iff the value is undefined / empty string, mirroring PromptService.considerUndefinedAsCancellation. */
class UserCancellationError extends Error {
  public readonly _tag = 'UserCancellationError';
}
const considerUndefinedAsCancellation = <T>(value: T | undefined): Effect.Effect<T, UserCancellationError> =>
  value === undefined || (typeof value === 'string' && value.trim().length === 0)
    ? Effect.fail(new UserCancellationError())
    : Effect.succeed(value);

describe('AuthParamsGatherer', () => {
  const buildLayer = () => {
    const mockServicesApi = {
      services: {
        // PromptService has accessors:false, so consumers `yield*` the service first
        PromptService: Effect.succeed({ considerUndefinedAsCancellation }),
        UserCancellationError
      }
    } as unknown as SalesforceVSCodeServicesApi;
    return Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
  };

  beforeEach(() => {
    resetOrgRuntimeForTesting();
    setAllServicesLayer(
      buildLayer() as ReturnType<typeof import('@salesforce/effect-ext-utils').buildAllServicesLayer>
    );
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
});
