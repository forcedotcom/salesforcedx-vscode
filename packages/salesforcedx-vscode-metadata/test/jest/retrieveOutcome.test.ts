/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { RetrieveOutcome } from 'salesforcedx-vscode-services';
import { retrieveHasErrors } from '../../src/shared/retrieve/retrieveOutcome';

const makeOutcome = (partial: Partial<RetrieveOutcome>): RetrieveOutcome => ({
  success: true,
  status: 'Succeeded',
  fileResponses: [],
  components: [],
  ...partial
});

describe('retrieveHasErrors', () => {
  it('returns true when any file response failed', () => {
    const outcome = makeOutcome({
      fileResponses: [
        {
          fullName: 'Foo',
          type: 'ApexClass',
          state: 'Failed',
          error: 'bad',
          problemType: 'Error'
        }
      ]
    });
    expect(retrieveHasErrors(outcome)).toBe(true);
  });

  it('returns true when response.success is false without file failures', () => {
    const outcome = makeOutcome({
      success: false,
      status: 'Succeeded',
      fileResponses: []
    });
    expect(retrieveHasErrors(outcome)).toBe(true);
  });

  it('returns true when status is SucceededPartial', () => {
    const outcome = makeOutcome({
      success: true,
      status: 'SucceededPartial',
      fileResponses: []
    });
    expect(retrieveHasErrors(outcome)).toBe(true);
  });

  it('returns false when succeeded with no failures', () => {
    const outcome = makeOutcome({
      success: true,
      status: 'Succeeded',
      fileResponses: [
        {
          fullName: 'Foo',
          type: 'ApexClass',
          state: 'Changed',
          filePath: '/x.cls'
        }
      ]
    });
    expect(retrieveHasErrors(outcome)).toBe(false);
  });
});
