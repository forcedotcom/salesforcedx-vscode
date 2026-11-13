/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import * as References from 'effect/References';
import { getServicesRuntime } from '../servicesRuntime';
import { redactSensitiveData } from './redactSensitiveData';

const replaceDefaultLogger = (
  loggers: ReadonlySet<Logger.Logger<unknown, unknown>>,
  replacement: Logger.Logger<unknown, unknown>
) => new Set([...loggers].filter(current => current !== Logger.defaultLogger).concat(replacement));

export const makeRedactingConsoleLoggerLayer = (redact: (text: string) => string) => {
  const logger = Logger.formatSimple.pipe(Logger.map(redact), Logger.withConsoleLog);
  return Layer.effect(
    References.CurrentLoggers,
    References.CurrentLoggers.pipe(Effect.map(loggers => replaceDefaultLogger(loggers, logger)))
  );
};

const defaultRedactingLogger = Logger.formatSimple.pipe(Logger.map(redactSensitiveData), Logger.withConsoleLog);
const replaceDefaultRedactingLogger = (loggers: ReadonlySet<Logger.Logger<unknown, unknown>>) =>
  replaceDefaultLogger(loggers, defaultRedactingLogger);
export const redactingConsoleLoggerLayer = makeRedactingConsoleLoggerLayer(redactSensitiveData);

/** Shared runtime so Effect.log hits the redacting logger. Unpublished runtime still uses that logger. */
export const runOnServicesRuntime = <A, E>(effect: Effect.Effect<A, E, never>) =>
  getServicesRuntime().pipe(
    Effect.flatMap(runtime =>
      runtime.contextEffect.pipe(Effect.flatMap(context => effect.pipe(Effect.provide(context))))
    ),
    Effect.catchTag('ServicesRuntimeNotReady', () =>
      effect.pipe(Effect.updateService(References.CurrentLoggers, replaceDefaultRedactingLogger))
    )
  );
