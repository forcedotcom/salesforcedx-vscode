/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { UNAUTHENTICATED_USER } from '../../../src/constants';

const ServicesExtensionNotFoundError = class extends Error {
  public readonly _tag = 'ServicesExtensionNotFoundError';
};
const InvalidServicesApiError = class extends Error {
  public readonly _tag = 'InvalidServicesApiError';
};

type OrgInfoShape = {
  cliId?: string;
  userId?: string;
  webUserId?: string;
  orgId?: string;
  isScratch?: boolean;
  isSandbox?: boolean;
  orgEdition?: string;
  devHubOrgId?: string;
  alias?: string;
  username?: string;
};
const mockApiState = {
  mode: 'happy' as 'happy' | 'no-ext' | 'invalid',
  identity: {} as OrgInfoShape
};

jest.mock('@salesforce/effect-ext-utils', () => {
  const ServicesExtensionNotFoundErrorClass = class extends Error {
    public readonly _tag = 'ServicesExtensionNotFoundError';
  };
  const InvalidServicesApiErrorClass = class extends Error {
    public readonly _tag = 'InvalidServicesApiError';
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const E = require('effect/Effect');
  return {
    ServicesExtensionNotFoundError: ServicesExtensionNotFoundErrorClass,
    InvalidServicesApiError: InvalidServicesApiErrorClass,
    get getServicesApi() {
      if (mockApiState.mode === 'no-ext') {
        return E.fail(new ServicesExtensionNotFoundErrorClass());
      }
      if (mockApiState.mode === 'invalid') {
        return E.fail(new InvalidServicesApiErrorClass());
      }
      return E.succeed({
        services: {
          TelemetryIdentitySnapshot: () => mockApiState.identity
        }
      });
    }
  };
});

jest.mock('vscode');

import { TelemetryService } from '../../../src/services/telemetry';

describe('TelemetryService.getIdentityFromServices', () => {
  beforeEach(() => {
    mockApiState.mode = 'happy';
    mockApiState.identity = {};
  });

  it('returns identity from defaultOrgRef on happy path', async () => {
    mockApiState.identity = { cliId: 'cli', userId: 'soql', webUserId: 'sha' };
    const result = await new TelemetryService().getIdentityFromServices();
    // bare mock has no org fields -> shapeFrom yields 'Undefined' (a defined key toEqual won't ignore)
    expect(result).toEqual(expect.objectContaining({ cliId: 'cli', webUserId: 'sha', orgShape: 'Undefined' }));
  });

  it('derives orgShape Production from alias via shapeFrom wiring', async () => {
    mockApiState.identity = { cliId: 'cli', webUserId: 'sha', alias: 'my-org' };
    const result = await new TelemetryService().getIdentityFromServices();
    expect(result.orgShape).toBe('Production');
  });

  it('derives orgShape Scratch and propagates org fields through the bridge', async () => {
    mockApiState.identity = {
      cliId: 'cli',
      webUserId: 'sha',
      isScratch: true,
      orgId: '00Dxx',
      devHubOrgId: '00Dhub',
      orgEdition: 'Developer Edition'
    };
    const result = await new TelemetryService().getIdentityFromServices();
    expect(result).toEqual(
      expect.objectContaining({
        orgShape: 'Scratch',
        orgId: '00Dxx',
        devHubId: '00Dhub',
        orgEdition: 'Developer Edition'
      })
    );
  });

  it('falls back webUserId to UNAUTHENTICATED_USER when missing', async () => {
    mockApiState.identity = { cliId: 'cli', userId: 'soql' };
    const result = await new TelemetryService().getIdentityFromServices();
    expect(result.webUserId).toBe(UNAUTHENTICATED_USER);
  });

  it('rejects when the services extension is missing', async () => {
    mockApiState.mode = 'no-ext';
    await expect(new TelemetryService().getIdentityFromServices()).rejects.toThrow();
  });

  it('rejects when the services API is invalid', async () => {
    mockApiState.mode = 'invalid';
    await expect(new TelemetryService().getIdentityFromServices()).rejects.toThrow();
  });

  it('runtime error tag classes are referenced', () => {
    expect(new ServicesExtensionNotFoundError()._tag).toBe('ServicesExtensionNotFoundError');
    expect(new InvalidServicesApiError()._tag).toBe('InvalidServicesApiError');
  });
});
