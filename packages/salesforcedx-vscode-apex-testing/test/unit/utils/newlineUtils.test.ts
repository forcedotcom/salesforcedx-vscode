/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import {
  type NewlineNormalizationState,
  normalizeTextChunkToLf,
  normalizeTextStreamToLf
} from '../../../src/utils/newlineUtils';

describe('normalizeTextChunkToLf', () => {
  it('normalizes CRLF split across adjacent chunks', () => {
    const state: NewlineNormalizationState = { hasTrailingCarriageReturn: false };

    expect(normalizeTextChunkToLf('a\r', state).normalizedText).toBe('a');
    expect(normalizeTextChunkToLf('\nb', state).normalizedText).toBe('\nb');
  });

  it('flushes a trailing carriage return as LF when given an empty final chunk', () => {
    const state: NewlineNormalizationState = { hasTrailingCarriageReturn: false };

    expect(normalizeTextChunkToLf('hello\r', state).normalizedText).toBe('hello');
    expect(normalizeTextChunkToLf('', state).normalizedText).toBe('\n');
  });

  it('normalizes mixed line endings within a chunk', () => {
    const state: NewlineNormalizationState = { hasTrailingCarriageReturn: false };

    expect(normalizeTextChunkToLf('a\r\nb\rc\nd', state).normalizedText).toBe('a\nb\nc\nd');
  });

  it('normalizes newlines across Effect stream chunks and flushes a trailing CR', async () => {
    const report = Stream.fromIterable(['a\r', '\nb\r', 'c\r']);
    const chunks = await Effect.runPromise(Stream.runCollect(normalizeTextStreamToLf(report)));

    expect(Chunk.toArray(chunks).join('')).toBe('a\nb\nc\n');
  });
});
