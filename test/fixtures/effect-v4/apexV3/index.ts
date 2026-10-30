/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { executeAnonymous } from './executeAnonymousCompat.js';

export const consumeV3 = (connection: Parameters<typeof executeAnonymous>[0]) =>
  executeAnonymous(connection, { apexCode: 'System.debug(1);' }).pipe(Effect.runPromise);
