/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

export const CODE_BUILDER_WEB_SECTION = 'salesforcedx-vscode-code-builder-web';
export const SALESFORCE_DX_SECTION = 'salesforcedx-vscode-salesforcedx';
const INSTANCE_URL_KEY = 'instanceUrl';
const ACCESS_TOKEN_KEY = 'accessToken';
const API_VERSION_KEY = 'apiVersion';

const FALLBACK_API_VERSION = '64.0';

const isNonEmptyString = (value: string | undefined): Effect.Effect<string, Error, never> =>
  value === undefined || value.length === 0 ? Effect.fail(new Error('Value is empty')) : Effect.succeed(value);

export class SettingsService extends Effect.Service<SettingsService>()('SettingsService', {
  succeed: {
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
        catch: error => new Error(`Failed to get setting ${section}.${key}: ${String(error)}`)
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
        catch: error => new Error(`Failed to set setting ${section}.${key}: ${String(error)}`)
      }),

    /**
     * Get the Salesforce instance URL from settings
     */
    getInstanceUrl: Effect.try({
      try: () => vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(INSTANCE_URL_KEY),
      catch: error => new Error(`Failed to get instanceUrl: ${String(error)}`)
    }).pipe(Effect.flatMap(isNonEmptyString)),

    /**
     * Get the Salesforce access token from settings
     */
    getAccessToken: Effect.try({
      try: () => vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(ACCESS_TOKEN_KEY),
      catch: error => new Error(`Failed to get accessToken: ${String(error)}`)
    }).pipe(Effect.flatMap(isNonEmptyString)),

    /**
     * Get the Salesforce API version from settings.  In the form of '64.0'
     */
    getApiVersion: Effect.try({
      try: () => {
        const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
        const value = config.get<string>(API_VERSION_KEY) ?? FALLBACK_API_VERSION;
        return value.length > 0 ? value : FALLBACK_API_VERSION;
      },
      catch: error => new Error(`Failed to get apiVersion: ${String(error)}`)
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
        catch: error => new Error(`Failed to set instanceUrl: ${String(error)}`)
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
        catch: error => new Error(`Failed to set accessToken: ${String(error)}`)
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
        catch: error => new Error(`Failed to set apiVersion: ${String(error)}`)
      })
  } as const
}) {}
