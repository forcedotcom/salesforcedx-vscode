/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createRecordingRuntimeMock, type RecordedSpan } from './testUtils/recordingTracer';

const mockRecordedSpans: RecordedSpan[] = [];

jest.mock('../../src/services/runtime', () => createRecordingRuntimeMock(() => mockRecordedSpans));

import { deactivate } from '../../src';

describe('deactivate', () => {
  it('records the extensionDeactivated span', () => {
    deactivate();

    expect(mockRecordedSpans).toEqual([
      expect.objectContaining({ name: 'extensionDeactivated', ended: true, attributes: new Map() })
    ]);
  });
});
