/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { getRuntime } from './runtime';

/**
 * Emit a standalone one-shot top-level span whose attributes ARE the payload (fire-and-forget).
 * `root: true` exports it as top-level rather than an orphaned child of any ambient span.
 */
export const fireSpan = (name: string, attributes: Record<string, string | number>): void => {
  getRuntime().runFork(Effect.void.pipe(Effect.withSpan(name, { attributes, root: true })));
};
