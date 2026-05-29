/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
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

export class SettingsError extends S.TaggedError<SettingsError>()('MissingSettingsError', {
  cause: S.Unknown,
  key: S.String,
  section: S.optional(S.String),
  message: S.String
}) {}

const isNonEmptyString = (key: string) => (value: string | undefined) =>
  value === undefined || value.length === 0
    ? Effect.fail(
        new SettingsError({
          cause: new Error(`Value for ${key} is empty`),
          key,
          message: `Value for ${key} is empty`
        })
      )
    : Effect.succeed(value);

/** Static service for reading and writing VS Code settings */
export class SettingsService extends Effect.Service<SettingsService>()('SettingsService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const getValue = Effect.fn('SettingsService.getValue')(function* <T>(
      section: string,
      key: string,
      defaultValue?: T
    ) {
      return yield* Effect.try({
        try: () => {
          const config = vscode.workspace.getConfiguration(section);
          return defaultValue !== undefined ? config.get<T>(key, defaultValue) : config.get<T>(key);
        },
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            section,
            key,
            message: `Failed to get setting ${section}.${key}: ${cause.message ?? String(cause)}`
          });
        }
      });
    });

    const setValue = Effect.fn('SettingsService.setValue')(function* <T>(section: string, key: string, value: T) {
      return yield* Effect.tryPromise({
        try: async () => {
          const config = vscode.workspace.getConfiguration(section);
          await config.update(key, value, vscode.ConfigurationTarget.Global);
        },
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            section,
            key,
            message: `Failed to set setting ${section}.${key}: ${cause.message ?? String(cause)}`
          });
        }
      });
    });

    const getInstanceUrl = Effect.fn('SettingsService.getInstanceUrl')(function* () {
      return yield* Effect.try({
        try: () => vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(INSTANCE_URL_KEY)?.trim(),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            key: INSTANCE_URL_KEY,
            section: CODE_BUILDER_WEB_SECTION,
            message: `Failed to get instance URL: ${cause.message ?? String(cause)}`
          });
        }
      }).pipe(Effect.flatMap(isNonEmptyString(INSTANCE_URL_KEY)));
    });

    const getAccessToken = Effect.fn('SettingsService.getAccessToken')(function* () {
      return yield* Effect.try({
        try: () => vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(ACCESS_TOKEN_KEY)?.trim(),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            key: ACCESS_TOKEN_KEY,
            section: CODE_BUILDER_WEB_SECTION,
            message: `Failed to get access token: ${cause.message ?? String(cause)}`
          });
        }
      }).pipe(Effect.flatMap(isNonEmptyString(ACCESS_TOKEN_KEY)));
    });

    const getApiVersion = Effect.fn('SettingsService.getApiVersion')(function* () {
      return yield* Effect.try({
        try: () => {
          const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
          const value = config.get<string>(API_VERSION_KEY) ?? FALLBACK_API_VERSION;
          return value.length > 0 ? value : FALLBACK_API_VERSION;
        },
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            key: API_VERSION_KEY,
            section: CODE_BUILDER_WEB_SECTION,
            message: `Failed to get API version: ${cause.message ?? String(cause)}`
          });
        }
      });
    });

    const setInstanceUrl = Effect.fn('SettingsService.setInstanceUrl')(function* (url: string) {
      return yield* Effect.tryPromise({
        try: async () => {
          const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
          await config.update(INSTANCE_URL_KEY, url, vscode.ConfigurationTarget.Global);
        },
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            key: INSTANCE_URL_KEY,
            section: CODE_BUILDER_WEB_SECTION,
            message: `Failed to set instance URL: ${cause.message ?? String(cause)}`
          });
        }
      });
    });

    const setAccessToken = Effect.fn('SettingsService.setAccessToken')(function* (token: string) {
      return yield* Effect.tryPromise({
        try: async () => {
          const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
          await config.update(ACCESS_TOKEN_KEY, token, vscode.ConfigurationTarget.Global);
        },
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            key: ACCESS_TOKEN_KEY,
            section: CODE_BUILDER_WEB_SECTION,
            message: `Failed to set access token: ${cause.message ?? String(cause)}`
          });
        }
      });
    });

    const setApiVersion = Effect.fn('SettingsService.setApiVersion')(function* (version: string) {
      return yield* Effect.tryPromise({
        try: async () => {
          const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
          await config.update(API_VERSION_KEY, version, vscode.ConfigurationTarget.Global);
        },
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            key: API_VERSION_KEY,
            section: CODE_BUILDER_WEB_SECTION,
            message: `Failed to set API version: ${cause.message ?? String(cause)}`
          });
        }
      });
    });

    const getRetrieveOnLoad = Effect.fn('SettingsService.getRetrieveOnLoad')(function* () {
      return yield* Effect.try({
        try: () => {
          const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
          return config.get<string>(RETRIEVE_ON_LOAD_KEY)?.trim() ?? '';
        },
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new SettingsError({
            cause,
            key: RETRIEVE_ON_LOAD_KEY,
            section: CODE_BUILDER_WEB_SECTION,
            message: `Failed to get retrieve on load setting: ${cause.message ?? String(cause)}`
          });
        }
      });
    });

    const getInternalDev = Effect.fn('SettingsService.getInternalDev')(function* () {
      return (yield* getValue<boolean>('salesforcedx-vscode-core', 'internal-development', false)) ?? false;
    });

    return {
      /** Get a value from settings. @param section The settings section @param key The settings key @param defaultValue Optional default value */
      getValue,
      /** Set a value in settings. @param section The settings section @param key The settings key @param value The value to set */
      setValue,
      /** Get the Salesforce instance URL from settings */
      getInstanceUrl,
      /** Get the Salesforce access token from settings */
      getAccessToken,
      /** Get the Salesforce API version from settings. In the form of '64.0' */
      getApiVersion,
      /** Set the Salesforce instance URL in settings */
      setInstanceUrl,
      /** Set the Salesforce access token in settings */
      setAccessToken,
      /** Set the Salesforce API version in settings */
      setApiVersion,
      /** Get the retrieve on load setting value */
      getRetrieveOnLoad,
      /** Read the salesforcedx-vscode-core.internal-development setting */
      getInternalDev
    };
  })
}) {}
