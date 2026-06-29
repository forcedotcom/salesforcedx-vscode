/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';

type TelemetryAttributes = Record<string, string | number | boolean>;

/** Log a telemetry event as an annotated span. Single home for the log+annotate+span shape. */
export const logTelemetry = (eventName: string, attributes: TelemetryAttributes): Effect.Effect<void> =>
  Effect.log(`[Telemetry] ${eventName}`).pipe(
    Effect.annotateLogs(attributes),
    Effect.withSpan(eventName, { attributes })
  );
