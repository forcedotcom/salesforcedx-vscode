/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import {
  CODE_BUILDER_WEB_SECTION,
  INSTANCE_URL_KEY,
  ACCESS_TOKEN_KEY,
  API_VERSION_KEY,
  RETRIEVE_ON_LOAD_KEY
} from '../constants';
import { unknownToErrorCause } from '../core/shared';

const FALLBACK_API_VERSION = '64.0';

export class SettingsError extends Data.TaggedError('MissingSettingsError')<{
  readonly cause: unknown;
  readonly key: string;
  readonly section?: string;
}> {}

const isNonEmptyString = (key: string) => (value: string | undefined) =>
  value === undefined || value.length === 0
    ? Effect.fail(new SettingsError({ cause: new Error(`Value for ${key} is empty`), key }))
    : Effect.succeed(value);

/** Static service for reading and writing VS Code settings */
export class SettingsService extends Effect.Service<SettingsService>()('SettingsService', {
  effect: Effect.succeed({
    /**
     * Get a value from settings
     * @param section The settings section
     * @param key The settings key
     * @param defaultValue Optional default value
     */
    getValue: <T>(section: string, key: string, defaultValue?: T) =>
      Effect.try({
        try: () => {
          const config = vscode.workspace.getConfiguration(section);
          return defaultValue !== undefined ? config.get<T>(key, defaultValue) : config.get<T>(key);
        },
        catch: error => new SettingsError({ cause: unknownToErrorCause(error), section, key })
      }),

    /**
     * Set a value in settings
     * @param section The settings section
     * @param key The settings key
     * @param value The value to set
     */
    setValue: <T>(section: string, key: string, value: T) =>
      Effect.tryPromise({
        try: async () => {
          const config = vscode.workspace.getConfiguration(section);
          await config.update(key, value, vscode.ConfigurationTarget.Global);
        },
        catch: error => new SettingsError({ cause: unknownToErrorCause(error), section, key })
      }),

    /**
     * Get the Salesforce instance URL from settings
     */
    getInstanceUrl: Effect.try({
      try: () => vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(INSTANCE_URL_KEY)?.trim(),
      catch: error =>
        new SettingsError({
          cause: unknownToErrorCause(error),
          key: INSTANCE_URL_KEY,
          section: CODE_BUILDER_WEB_SECTION
        })
    }).pipe(Effect.flatMap(isNonEmptyString(INSTANCE_URL_KEY))),

    /**
     * Get the Salesforce access token from settings
     */
    getAccessToken: Effect.try({
      try: () => vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(ACCESS_TOKEN_KEY)?.trim(),
      catch: error =>
        new SettingsError({
          cause: unknownToErrorCause(error),
          key: ACCESS_TOKEN_KEY,
          section: CODE_BUILDER_WEB_SECTION
        })
    }).pipe(Effect.flatMap(isNonEmptyString(ACCESS_TOKEN_KEY))),

    /**
     * Get the Salesforce API version from settings.  In the form of '64.0'
     */
    getApiVersion: Effect.try({
      try: () => {
        const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
        const value = config.get<string>(API_VERSION_KEY) ?? FALLBACK_API_VERSION;
        return value.length > 0 ? value : FALLBACK_API_VERSION;
      },
      catch: error =>
        new SettingsError({
          cause: unknownToErrorCause(error),
          key: API_VERSION_KEY,
          section: CODE_BUILDER_WEB_SECTION
        })
    }),

    /**
     * Set the Salesforce instance URL in settings
     */
    setInstanceUrl: (url: string) =>
      Effect.tryPromise({
        try: async () => {
          const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
          await config.update(INSTANCE_URL_KEY, url, vscode.ConfigurationTarget.Global);
        },
        catch: error =>
          new SettingsError({
            cause: unknownToErrorCause(error),
            key: INSTANCE_URL_KEY,
            section: CODE_BUILDER_WEB_SECTION
          })
      }),

    /**
     * Set the Salesforce access token in settings
     */
    setAccessToken: (token: string) =>
      Effect.tryPromise({
        try: async () => {
          const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
          await config.update(ACCESS_TOKEN_KEY, token, vscode.ConfigurationTarget.Global);
        },
        catch: error =>
          new SettingsError({
            cause: unknownToErrorCause(error),
            key: ACCESS_TOKEN_KEY,
            section: CODE_BUILDER_WEB_SECTION
          })
      }),

    /**
     * Set the Salesforce API version in settings
     */
    setApiVersion: (version: string) =>
      Effect.tryPromise({
        try: async () => {
          const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
          await config.update(API_VERSION_KEY, version, vscode.ConfigurationTarget.Global);
        },
        catch: error =>
          new SettingsError({
            cause: unknownToErrorCause(error),
            key: API_VERSION_KEY,
            section: CODE_BUILDER_WEB_SECTION
          })
      }),

    /** Get the retrieve on load setting value */
    getRetrieveOnLoad: Effect.try({
      try: () => {
        const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
        return config.get<string>(RETRIEVE_ON_LOAD_KEY)?.trim() ?? '';
      },
      catch: error =>
        new SettingsError({
          cause: unknownToErrorCause(error),
          key: RETRIEVE_ON_LOAD_KEY,
          section: CODE_BUILDER_WEB_SECTION
        })
    })
  } as const),
  dependencies: []
}) {}
