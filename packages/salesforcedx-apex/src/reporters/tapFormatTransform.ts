/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestResult } from '../tests/types';
import * as Effect from 'effect/Effect';
import * as os from 'node:os';
import type { ReadableOptions } from 'node:stream';
import { reportStreamToReadable } from '../utils/reportStream';
import { formatTapChunks } from './formatTap';

/** Creates a Node readable for compatibility with existing file writers. */
export const TapFormatTransformer = Effect.fn('Apex.TapFormatTransformer')(
  (testResult: TestResult, epilog?: string[], options?: ReadableOptions) =>
    Effect.sync(() => reportStreamToReadable(formatTapChunks(testResult, epilog, os.EOL), options))
);
