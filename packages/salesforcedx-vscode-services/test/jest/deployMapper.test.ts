/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { toDeployOutcome, toRetrieveOutcome } from '../../src/owned/deployMapper';

describe('toDeployOutcome', () => {
  it('maps a DeployResult to owned DeployOutcome', () => {
    const fake = {
      response: { success: true, status: 'Succeeded' },
      getFileResponses: () => [{ fullName: 'MyClass', type: 'ApexClass', state: 'Changed', filePath: '/p/MyClass.cls' }]
    };
    const out = toDeployOutcome(fake as never);
    expect(out.success).toBe(true);
    expect(out.status).toBe('Succeeded');
    expect(out.fileResponses[0]).toEqual({
      fullName: 'MyClass',
      type: 'ApexClass',
      state: 'Changed',
      filePath: '/p/MyClass.cls',
      error: undefined
    });
  });

  it('maps failed file responses with error', () => {
    const fake = {
      response: { success: false, status: 'Failed' },
      getFileResponses: () => [
        {
          fullName: 'BadClass',
          type: 'ApexClass',
          state: 'Failed',
          filePath: '/p/BadClass.cls',
          error: 'Compilation error',
          lineNumber: 10,
          columnNumber: 5,
          problemType: 'Error'
        }
      ]
    };
    const out = toDeployOutcome(fake as never);
    expect(out.success).toBe(false);
    expect(out.status).toBe('Failed');
    expect(out.fileResponses[0]).toEqual({
      fullName: 'BadClass',
      type: 'ApexClass',
      state: 'Failed',
      filePath: '/p/BadClass.cls',
      error: 'Compilation error'
    });
  });
});

describe('toRetrieveOutcome', () => {
  it('maps a RetrieveResult to owned RetrieveOutcome', () => {
    const fake = {
      response: { success: true, status: 'Succeeded' },
      getFileResponses: () => [{ fullName: 'MyClass', type: 'ApexClass', state: 'Created', filePath: '/p/MyClass.cls' }]
    };
    const out = toRetrieveOutcome(fake as never);
    expect(out.success).toBe(true);
    expect(out.status).toBe('Succeeded');
    expect(out.fileResponses[0]).toEqual({
      fullName: 'MyClass',
      type: 'ApexClass',
      state: 'Created',
      filePath: '/p/MyClass.cls',
      error: undefined
    });
  });
});
