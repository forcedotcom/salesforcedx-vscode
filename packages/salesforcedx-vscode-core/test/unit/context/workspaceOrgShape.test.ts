/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Mock as VitestMock } from 'vitest';
import * as Effect from 'effect/Effect';
import { getDefaultOrgInfo } from '../../../src/context/defaultOrgInfo';
import { getOrgShape } from '../../../src/context/workspaceOrgShape';

// Mutable workspace info the WorkspaceService mock returns; tests flip `isEmpty`.
const mockWorkspaceInfo = { isEmpty: false };

vi.mock('@salesforce/effect-ext-utils', async () => {
  const EffectLib = await vi.importActual<typeof import('effect/Effect')>('effect/Effect');
  const Context = await vi.importActual<typeof import('effect/Context')>('effect/Context');
  const MockExtensionProviderService = Context.GenericTag('ExtensionProviderService');
  const mockServicesApi = {
    services: {
      WorkspaceService: {
        getWorkspaceInfo: () => EffectLib.sync(() => mockWorkspaceInfo)
      }
    }
  };
  return {
    ExtensionProviderService: Object.assign(MockExtensionProviderService, {
      // ExtensionProviderService is a Context.GenericTag, yielded as a service value
      getServicesApi: EffectLib.succeed(mockServicesApi)
    })
  };
});

vi.mock('../../../src/context/defaultOrgInfo', () => ({
  getDefaultOrgInfo: vi.fn()
}));

// Real runtime: runs the actual getOrgShapeEffect (WorkspaceService -> getDefaultOrgInfo -> shapeFrom)
// and its catchAll, providing the mocked ExtensionProviderService tag.
vi.mock('../../../src/services/runtime', async () => {
  const EffectLib = await vi.importActual<typeof import('effect/Effect')>('effect/Effect');
  const { ExtensionProviderService } = await import('@salesforce/effect-ext-utils');
  return {
    getRuntime: () => ({
      runPromise: (effect: Effect.Effect<unknown>) =>
        EffectLib.runPromise(
          EffectLib.provideService(effect, ExtensionProviderService, ExtensionProviderService as never)
        )
    })
  };
});

const getDefaultOrgInfoMock = getDefaultOrgInfo as unknown as VitestMock;

describe('getOrgShape', () => {
  const username = 'test-user';

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceInfo.isEmpty = false;
  });

  it('returns Undefined when there is no root workspace (org info not read)', async () => {
    mockWorkspaceInfo.isEmpty = true;

    const result = await getOrgShape(username);

    expect(result).toBe('Undefined');
    expect(getDefaultOrgInfoMock).not.toHaveBeenCalled();
  });

  it('maps the resolved DefaultOrgInfo through shapeFrom (Sandbox)', async () => {
    getDefaultOrgInfoMock.mockReturnValue(Effect.succeed({ isSandbox: true }));

    expect(await getOrgShape(username)).toBe('Sandbox');
  });

  it('falls back to Undefined when reading org info fails (catchAll path)', async () => {
    getDefaultOrgInfoMock.mockReturnValue(Effect.fail(new Error('TargetOrgRef unavailable')));

    expect(await getOrgShape(username)).toBe('Undefined');
  });
});
