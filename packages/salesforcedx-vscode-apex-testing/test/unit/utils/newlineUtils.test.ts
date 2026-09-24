/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NewlineNormalizationState, normalizeTextChunkToLf } from '../../../src/utils/newlineUtils';

describe('newlineUtils', () => {
  it('should normalize CRLF split across chunk boundary to a single LF', () => {
    const state: NewlineNormalizationState = { hasTrailingCarriageReturn: false };

    const first = normalizeTextChunkToLf('a\r', state);
    expect(first.normalizedText).toBe('a');
    expect(state.hasTrailingCarriageReturn).toBe(true);

    const second = normalizeTextChunkToLf('\nb', state);
    expect(second.normalizedText).toBe('\nb');
    expect(state.hasTrailingCarriageReturn).toBe(false);
  });

  it('should convert a trailing CR at end of stream into LF on next (empty) chunk', () => {
    const state: NewlineNormalizationState = { hasTrailingCarriageReturn: false };

    const first = normalizeTextChunkToLf('hello\r', state);
    expect(first.normalizedText).toBe('hello');
    expect(state.hasTrailingCarriageReturn).toBe(true);

    const flush = normalizeTextChunkToLf('', state);
    expect(flush.normalizedText).toBe('\n');
    expect(state.hasTrailingCarriageReturn).toBe(false);
  });

  it('should normalize mixed newline styles within a single chunk', () => {
    const state: NewlineNormalizationState = { hasTrailingCarriageReturn: false };

    const { normalizedText } = normalizeTextChunkToLf('a\r\nb\rc\nd', state);
    expect(normalizedText).toBe('a\nb\nc\nd');
    expect(state.hasTrailingCarriageReturn).toBe(false);
  });
});
