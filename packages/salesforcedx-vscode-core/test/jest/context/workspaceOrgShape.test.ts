/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { getDefaultOrgInfo } from '../../../src/context/defaultOrgInfo';
import { getOrgShape, shapeFrom } from '../../../src/context/workspaceOrgShape';

// Mutable workspace info the WorkspaceService mock returns; tests flip `isEmpty`.
const mockWorkspaceInfo = { isEmpty: false };

jest.mock('@salesforce/effect-ext-utils', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const Context = jest.requireActual('effect/Context');
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

jest.mock('../../../src/context/defaultOrgInfo', () => ({
  getDefaultOrgInfo: jest.fn()
}));

// Real runtime: runs the actual getOrgShapeEffect (WorkspaceService -> getDefaultOrgInfo -> shapeFrom)
// and its catchAll, providing the mocked ExtensionProviderService tag.
jest.mock('../../../src/services/runtime', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const { ExtensionProviderService } = require('@salesforce/effect-ext-utils');
  return {
    getRuntime: () => ({
      runPromise: (effect: Effect.Effect<unknown>) =>
        EffectLib.runPromise(EffectLib.provideService(effect, ExtensionProviderService, ExtensionProviderService))
    })
  };
});

const getDefaultOrgInfoMock = getDefaultOrgInfo as unknown as jest.Mock;

describe('getOrgShape', () => {
  const username = 'test-user';

  beforeEach(() => {
    jest.clearAllMocks();
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

describe('shapeFrom', () => {
  it('returns Scratch when isScratch true', () => {
    expect(shapeFrom({ isScratch: true })).toBe('Scratch');
  });

  it('returns Sandbox when isSandbox true and isScratch false', () => {
    expect(shapeFrom({ isSandbox: true })).toBe('Sandbox');
  });

  it('prefers Scratch over Sandbox when both flags set (precedence)', () => {
    expect(shapeFrom({ isScratch: true, isSandbox: true })).toBe('Scratch');
  });

  it('returns Production when alias is set', () => {
    expect(shapeFrom({ alias: 'my-org' })).toBe('Production');
  });

  it('returns Production when only username is set', () => {
    expect(shapeFrom({ username: 'user@example.com' })).toBe('Production');
  });

  it('returns Undefined when nothing is populated', () => {
    expect(shapeFrom({})).toBe('Undefined');
  });
});
