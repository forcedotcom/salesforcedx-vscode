/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentStatus, RequestStatus, type FileResponse, type RetrieveResult } from '@salesforce/source-deploy-retrieve';
import { retrieveHasErrors } from '../../src/shared/retrieve/retrieveOutcome';

const isSDRFailure = (fr: FileResponse): boolean => fr.state === ComponentStatus.Failed;

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
  it('returns true when any file response failed', () => {
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
    expect(retrieveHasErrors(result, isSDRFailure)).toBe(true);
  });

  it('returns true when response.success is false without file failures', () => {
    const result = makeResult({
      fileResponses: [],
      response: { success: false, status: RequestStatus.Succeeded }
    });
    expect(retrieveHasErrors(result, isSDRFailure)).toBe(true);
  });

  it('returns true when status is SucceededPartial', () => {
    const result = makeResult({
      fileResponses: [],
      response: { status: RequestStatus.SucceededPartial, success: true }
    });
    expect(retrieveHasErrors(result, isSDRFailure)).toBe(true);
  });

  it('returns false when succeeded with no failures', () => {
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
    expect(retrieveHasErrors(result, isSDRFailure)).toBe(false);
  });
});
