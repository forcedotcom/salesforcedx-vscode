/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { UNAUTHENTICATED_USER } from '../../../src/constants';

const ServicesExtensionNotFoundError = class extends Error {
  public readonly _tag = 'ServicesExtensionNotFoundError';
};
const InvalidServicesApiError = class extends Error {
  public readonly _tag = 'InvalidServicesApiError';
};

type OrgInfoShape = { cliId?: string; userId?: string; webUserId?: string };
const makeRef = (info: OrgInfoShape) => Effect.runSync(SubscriptionRef.make<OrgInfoShape>(info));

const mockApiState = {
  mode: 'happy' as 'happy' | 'no-ext' | 'invalid',
  ref: undefined as SubscriptionRef.SubscriptionRef<OrgInfoShape> | undefined
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
          TargetOrgRef: () => E.succeed(mockApiState.ref)
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
    mockApiState.ref = makeRef({});
  });

  it('returns identity from defaultOrgRef on happy path', async () => {
    mockApiState.ref = makeRef({ cliId: 'cli', userId: 'soql', webUserId: 'sha' });
    const result = await new TelemetryService().getIdentityFromServices();
    expect(result).toEqual({ cliId: 'cli', userId: 'soql', webUserId: 'sha' });
  });

  it('falls back webUserId to UNAUTHENTICATED_USER when missing', async () => {
    mockApiState.ref = makeRef({ cliId: 'cli', userId: 'soql' });
    const result = await new TelemetryService().getIdentityFromServices();
    expect(result.webUserId).toBe(UNAUTHENTICATED_USER);
  });

  it('recovers ServicesExtensionNotFoundError to degraded identity', async () => {
    mockApiState.mode = 'no-ext';
    const result = await new TelemetryService().getIdentityFromServices();
    expect(result).toEqual({ cliId: undefined, userId: undefined, webUserId: UNAUTHENTICATED_USER });
  });

  it('recovers InvalidServicesApiError to degraded identity', async () => {
    mockApiState.mode = 'invalid';
    const result = await new TelemetryService().getIdentityFromServices();
    expect(result).toEqual({ cliId: undefined, userId: undefined, webUserId: UNAUTHENTICATED_USER });
  });

  it('runtime error tag classes are referenced', () => {
    expect(new ServicesExtensionNotFoundError()._tag).toBe('ServicesExtensionNotFoundError');
    expect(new InvalidServicesApiError()._tag).toBe('InvalidServicesApiError');
  });
});
