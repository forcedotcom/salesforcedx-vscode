/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { AllServicesLayer } from '../services/extensionProvider';

/** Log a telemetry event with attributes via Effect spans */
const logEvent = (eventName: string, attributes?: Record<string, string | number | boolean>): void => {
  Effect.runPromise(
    Effect.log(`[Telemetry] ${eventName}`).pipe(
      Effect.annotateLogs(attributes ?? {}),
      Effect.withSpan(eventName, { attributes }),
      Effect.provide(AllServicesLayer)
    )
  ).catch(() => {
    // Best effort - don't fail if telemetry fails
  });
};

/**
 * Simplified telemetry service for backward compatibility.
 * Prefer using Effect.withSpan directly in Effect-based code.
 */
export const telemetryService = {
  /** No-op for backward compatibility - initialization happens via AllServicesLayer */
  initializeService: async (_context: unknown): Promise<void> => {},

  /** Log an event with properties and measures as span attributes */
  sendEventData: (eventName: string, properties?: Record<string, string>, measures?: Record<string, number>): void => {
    logEvent(eventName, { ...properties, ...measures });
  },

  /** Log extension deactivation */
  sendExtensionDeactivationEvent: (): void => {
    logEvent('extensionDeactivated');
  }
};
