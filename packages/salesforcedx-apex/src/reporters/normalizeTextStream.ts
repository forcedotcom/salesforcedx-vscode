/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ReportLineEnding } from './lineEnding';
import * as Stream from 'effect/Stream';

type NewlineState = { hasTrailingCarriageReturn: boolean };

/** Normalizes newlines across text chunks, including CRLF split between adjacent chunks. */
export const normalizeTextStream = <E, R>(report: Stream.Stream<string, E, R>, lineEnding: ReportLineEnding) =>
  report.pipe(
    Stream.concat(Stream.make('')),
    Stream.mapAccum<NewlineState, string, string>({ hasTrailingCarriageReturn: false }, (state, chunk) => {
      const prefix = state.hasTrailingCarriageReturn ? lineEnding : '';
      const withoutCarriedNewline = state.hasTrailingCarriageReturn && chunk.startsWith('\n') ? chunk.slice(1) : chunk;
      const hasTrailingCarriageReturn = withoutCarriedNewline.endsWith('\r');
      const text = hasTrailingCarriageReturn ? withoutCarriedNewline.slice(0, -1) : withoutCarriedNewline;
      return [{ hasTrailingCarriageReturn }, `${prefix}${text}`.replaceAll(/\r\n|\r|\n/g, lineEnding)] as const;
    }),
    Stream.filter(chunk => chunk.length > 0)
  );
