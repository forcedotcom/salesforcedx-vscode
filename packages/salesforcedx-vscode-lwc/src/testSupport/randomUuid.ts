/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Random from 'effect/Random';

/** A version 4 UUID generated from Effect-injected randomness. */
export const randomUuid = Effect.gen(function* () {
  const bytes = yield* Effect.all(Array.from({ length: 16 }, () => Random.nextIntBetween(0, 256)));
  const hex = bytes
    .map((byte, index) => (index === 6 ? (byte & 0x0f) | 0x40 : index === 8 ? (byte & 0x3f) | 0x80 : byte))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
});
