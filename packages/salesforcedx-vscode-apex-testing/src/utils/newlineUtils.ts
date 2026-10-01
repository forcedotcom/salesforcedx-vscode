/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type NewlineNormalizationState = {
  hasTrailingCarriageReturn: boolean;
};

/** Normalizes text chunk newlines to LF, correctly handling CRLF split across chunk boundaries */
export const normalizeTextChunkToLf = (
  rawText: string,
  state: NewlineNormalizationState
): { normalizedText: string; state: NewlineNormalizationState } => {
  const prefix = state.hasTrailingCarriageReturn ? '\n' : '';
  // A trailing '\r' carried from the previous chunk pairs with a leading '\n' here → drop the '\n' (CRLF already emitted as one '\n' via prefix).
  const withoutCarriedNewline =
    state.hasTrailingCarriageReturn && rawText.startsWith('\n') ? rawText.slice(1) : rawText;
  const hasTrailingCarriageReturn = withoutCarriedNewline.endsWith('\r');
  const text = hasTrailingCarriageReturn ? withoutCarriedNewline.slice(0, -1) : withoutCarriedNewline;

  state.hasTrailingCarriageReturn = hasTrailingCarriageReturn;

  const normalizedText = `${prefix}${text}`.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return { normalizedText, state };
};
