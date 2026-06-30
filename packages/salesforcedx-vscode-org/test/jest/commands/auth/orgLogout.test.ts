/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, StateAggregator } from '@salesforce/core';
import {
  ExtensionProviderService,
  type ExtensionProviderService as ExtensionProviderServiceType
} from '@salesforce/effect-ext-utils';
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { OrgLogoutDefault } from '../../../../src/commands/auth/orgLogout';
import { resetOrgRuntimeForTesting, setAllServicesLayer } from '../../../../src/extensionProvider';
import * as orgUtil from '../../../../src/util/orgUtil';

jest.mock('../../../../src/telemetry', () => ({
  telemetryService: { sendException: jest.fn() }
}));

jest.mock('../../../../src/channels', () => ({
  OUTPUT_CHANNEL: {}
}));

// selectOrgsForLogout imports orgList.ts which has a pre-existing toSorted ts-jest issue
jest.mock('../../../../src/parameterGatherers/selectOrgsForLogout');

describe('OrgLogoutDefault', () => {
  let removeAuthMock: jest.Mock;
  let clearInstanceAsyncMock: jest.SpyInstance;
  let createMock: jest.SpyInstance;
  let unsetTargetOrgMock: jest.Mock;

  const buildLayer = () => {
    const mockServicesApi = {
      services: {
        ConfigService: {
          unsetTargetOrg: unsetTargetOrgMock
        }
      }
    } as unknown as SalesforceVSCodeServicesApi;
    return Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    createMock = jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);
    clearInstanceAsyncMock = jest.spyOn(StateAggregator, 'clearInstanceAsync').mockResolvedValue(undefined);
    unsetTargetOrgMock = jest.fn().mockReturnValue(Effect.void);

    jest.spyOn(orgUtil, 'updateConfigAndStateAggregators').mockResolvedValue(undefined);

    resetOrgRuntimeForTesting();
    setAllServicesLayer(
      buildLayer() as ReturnType<typeof import('@salesforce/effect-ext-utils').buildAllServicesLayer>
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Asserts the full happy path: removeAuth routed the username, the reactive TargetOrgRef was cleared
  // via unsetTargetOrg (so the status bar reverts to "No Default Org Set"), caches refreshed, result
  // true, and (regression guard) the StateAggregator singleton is cleared BEFORE the AuthRemover is
  // created so removeAuth's in-memory alias read cannot drop an alias added after extension boot.
  it('clears the singleton, removes auth, unsets target-org, and refreshes extension caches', async () => {
    const username = 'user@example.com';

    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(unsetTargetOrgMock).toHaveBeenCalledTimes(1);
    expect(orgUtil.updateConfigAndStateAggregators).toHaveBeenCalledTimes(1);
    expect(clearInstanceAsyncMock.mock.invocationCallOrder[0]).toBeLessThan(createMock.mock.invocationCallOrder[0]);
  });

  it('returns false and does not refresh caches when auth removal fails', async () => {
    removeAuthMock.mockRejectedValue(new Error('removal failed'));

    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: 'user@example.com' });

    expect(result).toBe(false);
    expect(orgUtil.updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });
});
