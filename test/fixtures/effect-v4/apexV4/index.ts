/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { executeAnonymous, ExecuteAnonymousOutcomeSchema } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

export const consumeV4 = (connection: Parameters<typeof executeAnonymous>[0]) =>
  executeAnonymous(connection, { apexCode: 'System.debug(1);' }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(ExecuteAnonymousOutcomeSchema)),
    Effect.runPromise
  );
