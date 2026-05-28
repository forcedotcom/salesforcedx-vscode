/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { getRuntime } from '../services/runtime';

export const telemetryService = {
  sendEventData: (eventName: string, properties?: Record<string, string>, measures?: Record<string, number>): void => {
    getRuntime()
      .runPromise(
        Effect.log(`[Telemetry] ${eventName}`).pipe(
          Effect.annotateLogs({ ...properties, ...measures }),
          Effect.withSpan(eventName, { attributes: { ...properties, ...measures } })
        )
      )
      .catch(() => {});
  }
};
