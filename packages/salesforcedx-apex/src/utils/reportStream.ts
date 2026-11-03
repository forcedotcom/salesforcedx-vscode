/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Stream from 'effect/Stream';
import { Readable, type ReadableOptions } from 'node:stream';

/** Adapts an Effect stream to a Node readable without buffering the whole report. */
export const reportStreamToReadable = (chunks: Stream.Stream<string>, options?: ReadableOptions): Readable =>
  Readable.from(Stream.toAsyncIterable(chunks), { objectMode: false, ...options });
