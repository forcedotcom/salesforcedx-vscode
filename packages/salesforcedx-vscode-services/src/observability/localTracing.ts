/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as LogLevel from 'effect/LogLevel';
import { SALESFORCE_DX_SECTION } from '../constants';
import { SettingsService } from '../vscode/settingsService';

/**
 * Get local traces enabled setting.  Sends traces to a locally running docker container.
 * See setting description for how to use
 */
export const getLocalTracesEnabled = () => getBooleanConfiguration('enableLocalTraces');

/** export spans/traces to console (browser or nodejs) */
export const getConsoleTracesEnabled = () => getBooleanConfiguration('enableConsoleTraces');

/** Export all spans in OTLP JSON format to ~/.sf/vscode-spans/ for Grafana import (support troubleshooting). */
export const getFileTracesEnabled = () => getBooleanConfiguration('enableFileTraces');

/** Resolve the minimum Effect log level from the VS Code setting, falling back to SF_LOG_LEVEL env var. */
export const getLogLevel = Effect.fn('getLogLevel')(function* () {
  const sfLogLevel = process.env.SF_LOG_LEVEL;
  const fallback = sfLogLevel === 'fatal' ? 'error' : (sfLogLevel ?? 'error');
  return yield* (yield* SettingsService).getValue<string>(SALESFORCE_DX_SECTION, 'logLevel').pipe(
    Effect.map(raw => mapSfLogLevel(raw ?? fallback))
  );
});

const mapSfLogLevel = (level: string): LogLevel.LogLevel => {
  switch (level.toLowerCase()) {
    case 'trace':
      return LogLevel.Trace;
    case 'debug':
      return LogLevel.Debug;
    case 'info':
      return LogLevel.Info;
    case 'warn':
    case 'warning':
      return LogLevel.Warning;
    case 'error':
    case 'fatal':
      return LogLevel.Error;
    default:
      return LogLevel.Info;
  }
};

const getBooleanConfiguration = (key: string) =>
  SettingsService.pipe(Effect.flatMap(settings => settings.getValueOrElse(SALESFORCE_DX_SECTION, key, false)));
