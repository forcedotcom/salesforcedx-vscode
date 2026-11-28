/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { normalizeTextStream } from '../../src/reporters/normalizeTextStream';

describe('normalizeTextStream', () => {
  it.each(['\n', '\r\n'] as const)('normalizes mixed newlines split across chunks to %j', async lineEnding => {
    const report = Stream.fromIterable(['first\r', '\nsecond\r', 'third\nlast\r']);
    const normalized = await Effect.runPromise(
      normalizeTextStream(report, lineEnding).pipe(
        Stream.runCollect,
        Effect.map(chunks => chunks.join(''))
      )
    );

    expect(normalized).toBe(['first', 'second', 'third', 'last', ''].join(lineEnding));
  });
});
