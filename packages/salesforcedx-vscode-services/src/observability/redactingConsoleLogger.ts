/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Logger from 'effect/Logger';
import { getServicesRuntime } from '../servicesRuntime';
import { redactSensitiveData } from './redactSensitiveData';

const redactingConsoleLogger = Logger.stringLogger.pipe(Logger.map(redactSensitiveData), Logger.withConsoleLog);

export const redactingConsoleLoggerLayer = Logger.replace(Logger.defaultLogger, redactingConsoleLogger);

/** Shared runtime so Effect.log hits the redacting logger. Unpublished runtime still logs via that layer. */
export const runOnServicesRuntime = <A, E>(effect: Effect.Effect<A, E, never>) =>
  getServicesRuntime().pipe(
    Effect.flatMap(runtime => effect.pipe(Effect.provide(runtime))),
    Effect.catchTag('ServicesRuntimeNotReady', () => effect.pipe(Effect.provide(redactingConsoleLoggerLayer)))
  );
