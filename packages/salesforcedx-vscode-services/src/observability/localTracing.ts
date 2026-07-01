/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as LogLevel from 'effect/LogLevel';
import * as vscode from 'vscode';
import { SALESFORCE_DX_SECTION } from '../constants';

/**
 * Get local traces enabled setting.  Sends traces to a locally running docker container.
 * See setting description for how to use
 */
export const getLocalTracesEnabled = (): boolean =>
  getOptionalBooleanConfiguration(SALESFORCE_DX_SECTION)('enableLocalTraces');

/** export spans/traces to console (browser or nodejs) */
export const getConsoleTracesEnabled = (): boolean =>
  getOptionalBooleanConfiguration(SALESFORCE_DX_SECTION)('enableConsoleTraces');

/** Export all spans in OTLP JSON format to ~/.sf/vscode-spans/ for Grafana import (support troubleshooting). */
export const getFileTracesEnabled = (): boolean =>
  getOptionalBooleanConfiguration(SALESFORCE_DX_SECTION)('enableFileTraces');

/** Resolve the minimum Effect log level from the VS Code setting, falling back to SF_LOG_LEVEL env var. */
export const getLogLevel = (): LogLevel.LogLevel => {
  const sfLogLevel = process.env.SF_LOG_LEVEL;
  const fallback = sfLogLevel === 'fatal' ? 'error' : (sfLogLevel ?? 'error');
  const raw = getOptionalStringConfiguration(SALESFORCE_DX_SECTION)('logLevel') ?? fallback;
  return mapSfLogLevel(raw);
};

const mapSfLogLevel = (level: string): LogLevel.LogLevel => {
  // Defensive: config/env sources can yield a non-string at runtime despite the typed contract.
  switch (String(level).toLowerCase()) {
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

const getOptionalBooleanConfiguration =
  (section: string) =>
  (configName: string): boolean => {
    // eslint-disable-next-line functional/no-try-statements
    try {
      const config = vscode.workspace.getConfiguration(section);
      return config.get(configName) ?? false;
    } catch {
      // Return false during tests or when VS Code API is not available
      return false;
    }
  };

const getOptionalStringConfiguration =
  (section: string) =>
  (configName: string): string | undefined => {
    // eslint-disable-next-line functional/no-try-statements
    try {
      const config = vscode.workspace.getConfiguration(section);
      return config.get<string>(configName);
    } catch {
      return undefined;
    }
  };
