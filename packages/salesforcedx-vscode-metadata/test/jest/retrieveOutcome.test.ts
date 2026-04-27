/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  ComponentStatus,
  RequestStatus,
  type FileResponse,
  type RetrieveResult
} from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import { isSDRFailure, toRequestStatus } from 'salesforcedx-vscode-services/src/core/sdrGuards';
import { retrieveHasErrors } from '../../src/shared/retrieve/retrieveOutcome';

const mockExtensionProvider: ExtensionProviderService = {
  getServicesApi: Effect.succeed({
    services: {
      ComponentSetService: Effect.succeed({ isSDRFailure, toRequestStatus })
    }
  } as unknown as SalesforceVSCodeServicesApi)
};

const run = <A>(effect: Effect.Effect<A, unknown, unknown>) =>
  Effect.runPromise(
    effect.pipe(Effect.provideService(ExtensionProviderService, mockExtensionProvider)) as Effect.Effect<
      A,
      never,
      never
    >
  );

const makeResult = (partial: {
  fileResponses?: FileResponse[];
  response?: Partial<RetrieveResult['response']>;
}): RetrieveResult => {
  const response = {
    done: true,
    fileProperties: [],
    id: 'id',
    status: RequestStatus.Succeeded,
    success: true,
    zipFile: '',
    ...partial.response
  } as RetrieveResult['response'];
  return {
    response,
    getFileResponses: () => partial.fileResponses ?? []
  } as RetrieveResult;
};

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
        }
      ]
    });
    expect(await run(retrieveHasErrors(result))).toBe(true);
  });

  it('returns true when response.success is false without file failures', async () => {
    const result = makeResult({
      fileResponses: [],
      response: { success: false, status: RequestStatus.Succeeded }
    });
    expect(await run(retrieveHasErrors(result))).toBe(true);
  });

  it('returns true when status is SucceededPartial', async () => {
    const result = makeResult({
      fileResponses: [],
      response: { status: RequestStatus.SucceededPartial, success: true }
    });
    expect(await run(retrieveHasErrors(result))).toBe(true);
  });

  it('returns false when succeeded with no failures', async () => {
    const result = makeResult({
      fileResponses: [
        {
          fullName: 'Foo',
          type: 'ApexClass',
          state: ComponentStatus.Changed,
          filePath: '/x.cls'
        }
      ],
      response: { status: RequestStatus.Succeeded, success: true }
    });
    expect(await run(retrieveHasErrors(result))).toBe(false);
  });
});
