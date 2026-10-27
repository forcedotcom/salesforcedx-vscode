/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Readable } from 'node:stream';

/** Pushes report chunks until the stream applies backpressure or the iterator ends. */
export const pushReportChunks = (stream: Readable, chunks: Iterator<string, void>): void => {
  let chunk = chunks.next();
  while (!chunk.done) {
    if (!stream.push(chunk.value)) return;
    chunk = chunks.next();
  }
  stream.push(null); // Signal the end of the stream.
};
