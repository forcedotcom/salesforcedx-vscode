/*
 * Copyright (c) 2025, salesforce.com, inc.
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
  let text = rawText;
  let prefix = '';

  if (state.hasTrailingCarriageReturn) {
    prefix = '\n';
    state.hasTrailingCarriageReturn = false;
    if (text.startsWith('\n')) {
      text = text.slice(1);
    }
  }

  if (text.endsWith('\r')) {
    state.hasTrailingCarriageReturn = true;
    text = text.slice(0, -1);
  }

  const normalizedText = `${prefix}${text}`.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  return { normalizedText, state };
};
