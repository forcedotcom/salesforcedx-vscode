/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ComponentStatus,
  type FileResponse,
  type RetrieveResult,
  RequestStatus
} from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { ComponentSetService } from 'salesforcedx-vscode-services/src/core/componentSetService';
import { isSDRFailure, isSDRSuccess, toRequestStatus } from 'salesforcedx-vscode-services/src/core/sdrGuards';
import { retrieveHasErrors } from '../../src/shared/retrieve/retrieveOutcome';

const makeResult = (options: {
  fileResponses?: FileResponse[];
  responseSuccess?: boolean;
  responseStatus?: RequestStatus;
}): RetrieveResult => {
  const { fileResponses = [], responseSuccess = true, responseStatus = RequestStatus.Succeeded } = options;
  return {
    getFileResponses: () => fileResponses,
    response: {
      success: responseSuccess,
      status: responseStatus
    }
  } as RetrieveResult;
};

// Mock ComponentSetService layer for testing
const mockComponentSetServiceLayer = Layer.succeed(
  ComponentSetService,
  new ComponentSetService({
    isSDRFailure,
    toRequestStatus,
    isSDRSuccess,
    getComponentState: () => 'changed',
    makeFileResponseFailure: () => ({}) as any,
    ensureNonEmptyComponentSet: () => Effect.succeed({} as any),
    getComponentSetFromUris: () => Effect.succeed({} as any),
    getComponentSetFromManifest: () => Effect.succeed({} as any),
    getComponentSetFromProjectDirectories: () => Effect.succeed({} as any),
    buildComponentSet: () => Effect.succeed({} as any),
    describeProjectComponents: () => Effect.succeed({} as any)
  })
);

const mockExtensionProvider = Layer.succeed(
  ExtensionProviderService,
  ExtensionProviderService.of({
    getServicesApi: Effect.succeed({
      services: {
        ComponentSetService
      }
    }) as any
  })
);

const testLayer = Layer.merge(mockComponentSetServiceLayer, mockExtensionProvider);

describe('retrieveHasErrors', () => {
  it('returns true when any file response failed', async () => {
    const result = makeResult({
      fileResponses: [
        {
          fullName: 'Foo',
          type: 'ApexClass',
          state: ComponentStatus.Failed,
          error: 'bad',
          problemType: 'Error'
        } as FileResponse
      ]
    });
    const hasErrors = await Effect.runPromise(retrieveHasErrors(result).pipe(Effect.provide(testLayer)));
    expect(hasErrors).toBe(true);
  });

  it('returns true when response.success is false without file failures', async () => {
    const result = makeResult({
      fileResponses: [],
      responseSuccess: false
    });
    const hasErrors = await Effect.runPromise(retrieveHasErrors(result).pipe(Effect.provide(testLayer)));
    expect(hasErrors).toBe(true);
  });

  it('returns true when status is SucceededPartial', async () => {
    const result = makeResult({
      fileResponses: [],
      responseStatus: RequestStatus.SucceededPartial
    });
    const hasErrors = await Effect.runPromise(retrieveHasErrors(result).pipe(Effect.provide(testLayer)));
    expect(hasErrors).toBe(true);
  });

  it('returns false when succeeded with no failures', async () => {
    const result = makeResult({
      fileResponses: [
        {
          fullName: 'Foo',
          type: 'ApexClass',
          state: ComponentStatus.Changed,
          filePath: '/x.cls'
        } as FileResponse
      ]
    });
    const hasErrors = await Effect.runPromise(retrieveHasErrors(result).pipe(Effect.provide(testLayer)));
    expect(hasErrors).toBe(false);
  });
});
