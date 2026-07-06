/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import {
  ExtensionProviderService,
  type ExtensionProviderService as ExtensionProviderServiceType
} from '@salesforce/effect-ext-utils';
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { OrgLogoutDefault } from '../../../../src/commands/auth/orgLogout';
import { resetOrgRuntimeForTesting, setAllServicesLayer } from '../../../../src/extensionProvider';

jest.mock('../../../../src/telemetry', () => ({
  telemetryService: { sendException: jest.fn() }
}));

jest.mock('../../../../src/channels', () => ({
  OUTPUT_CHANNEL: {}
}));

describe('OrgLogoutDefault', () => {
  let removeAuthMock: jest.Mock;
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
    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);

    unsetTargetOrgMock = jest.fn().mockReturnValue(Effect.void);

    resetOrgRuntimeForTesting();
    setAllServicesLayer(
      buildLayer() as ReturnType<typeof import('@salesforce/effect-ext-utils').buildAllServicesLayer>
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls removeAuth then clears the target-org ref in-process, returning true', async () => {
    const username = 'user@example.com';
    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    // in-process ref clear (not the async config-file watcher) is what clears the apex-testing tree
    expect(unsetTargetOrgMock).toHaveBeenCalledTimes(1);
  });

  it('returns false and does not throw when removeAuth rejects', async () => {
    const username = 'user@example.com';
    removeAuthMock.mockRejectedValue(new Error('removal failed'));

    const executor = new OrgLogoutDefault();
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(false);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    // removeAuth failed before the ref clear, so it must not run
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });
});
