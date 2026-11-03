/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Stream from 'effect/Stream';

export type NewlineNormalizationState = {
  hasTrailingCarriageReturn: boolean;
};

/** Normalizes newline sequences across streamed text chunks and flushes a final trailing CR. */
export const normalizeTextStreamToLf = <E, R>(report: Stream.Stream<string, E, R>) =>
  report.pipe(
    Stream.concat(Stream.make('')),
    Stream.mapAccum<NewlineNormalizationState, string, string>({ hasTrailingCarriageReturn: false }, (state, chunk) => {
      const { normalizedText, state: nextState } = normalizeTextChunkToLf(chunk, { ...state });
      return [nextState, normalizedText] as const;
    }),
    Stream.filter(chunk => chunk.length > 0)
  );

/** Normalizes text chunk newlines to LF, correctly handling CRLF split across chunks. */
export const normalizeTextChunkToLf = (
  rawText: string,
  state: NewlineNormalizationState
): { normalizedText: string; state: NewlineNormalizationState } => {
  const prefix = state.hasTrailingCarriageReturn ? '\n' : '';
  const withoutCarriedNewline =
    state.hasTrailingCarriageReturn && rawText.startsWith('\n') ? rawText.slice(1) : rawText;
  const hasTrailingCarriageReturn = withoutCarriedNewline.endsWith('\r');
  const text = hasTrailingCarriageReturn ? withoutCarriedNewline.slice(0, -1) : withoutCarriedNewline;
  state.hasTrailingCarriageReturn = hasTrailingCarriageReturn;
  return {
    normalizedText: `${prefix}${text}`.replaceAll('\r\n', '\n').replaceAll('\r', '\n'),
    state
  };
};
