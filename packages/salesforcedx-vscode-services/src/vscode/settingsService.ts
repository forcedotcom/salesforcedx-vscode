/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';

export const CODE_BUILDER_WEB_SECTION = 'salesforcedx-vscode-code-builder-web';
export const SALESFORCE_DX_SECTION = 'salesforcedx-vscode-salesforcedx';
const INSTANCE_URL_KEY = 'instanceUrl';
const ACCESS_TOKEN_KEY = 'accessToken';
const API_VERSION_KEY = 'apiVersion';

const FALLBACK_API_VERSION = '64.0';

const isNonEmptyString =
  (key: string) =>
  (value: string | undefined): Effect.Effect<string, Error, never> =>
    value === undefined || value.length === 0
      ? Effect.fail(new Error(`Value for ${key} is empty`))
      : Effect.succeed(value);

/**
 * Service for interacting with VSCode settings
 */
export type SettingsService = {
  /**
   * Get a value from settings
   * @param section The settings section
   * @param key The settings key
   * @param defaultValue Optional default value
   */
  readonly getValue: <T>(section: string, key: string, defaultValue?: T) => Effect.Effect<T | undefined, Error, never>;

  /**
   * Set a value in settings
   * @param section The settings section
   * @param key The settings key
   * @param value The value to set
   */
  readonly setValue: <T>(section: string, key: string, value: T) => Effect.Effect<void, Error, never>;

  /**
   * Get the Salesforce instance URL from settings
   */
  readonly getInstanceUrl: Effect.Effect<string, Error, never>;

  /**
   * Get the Salesforce access token from settings
   */
  readonly getAccessToken: Effect.Effect<string, Error, never>;

  /**
   * Get the Salesforce API version from settings.  In the form of '64.0'
   */
  readonly getApiVersion: Effect.Effect<string, Error, never>;

  /**
   * Set the Salesforce instance URL in settings
   */
  readonly setInstanceUrl: (url: string) => Effect.Effect<void, Error, never>;

  /**
   * Set the Salesforce access token in settings
   */
  readonly setAccessToken: (token: string) => Effect.Effect<void, Error, never>;

  /**
   * Set the Salesforce API version in settings
   */
  readonly setApiVersion: (version: string) => Effect.Effect<void, Error, never>;
};

export const SettingsService = Context.GenericTag<SettingsService>('SettingsService');

export const SettingsServiceLive = Layer.succeed(SettingsService, {
  getValue: <T>(section: string, key: string, defaultValue?: T) =>
    Effect.try({
      try: () => {
        const config = vscode.workspace.getConfiguration(section);
        return defaultValue !== undefined ? config.get<T>(key, defaultValue) : config.get<T>(key);
      },
      catch: error => new Error(`Failed to get setting ${section}.${key}: ${String(error)}`)
    }),

  setValue: <T>(section: string, key: string, value: T) =>
    Effect.tryPromise({
      try: async () => {
        const config = vscode.workspace.getConfiguration(section);
        await config.update(key, value, vscode.ConfigurationTarget.Global);
      },
      catch: error => new Error(`Failed to set setting ${section}.${key}: ${String(error)}`)
    }),

  getInstanceUrl: Effect.try({
    try: () => vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(INSTANCE_URL_KEY),
    catch: error => new Error(`Failed to get instanceUrl: ${String(error)}`)
  }).pipe(Effect.flatMap(isNonEmptyString(INSTANCE_URL_KEY))),

  getAccessToken: Effect.try({
    try: () => vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(ACCESS_TOKEN_KEY),
    catch: error => new Error(`Failed to get accessToken: ${String(error)}`)
  }).pipe(Effect.flatMap(isNonEmptyString(ACCESS_TOKEN_KEY))),

  getApiVersion: Effect.try({
    try: () => {
      const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
      const value = config.get<string>(API_VERSION_KEY) ?? FALLBACK_API_VERSION;
      return value.length > 0 ? value : FALLBACK_API_VERSION;
    },
    catch: error => new Error(`Failed to get apiVersion: ${String(error)}`)
  }),

  setInstanceUrl: (url: string) =>
    Effect.tryPromise({
      try: async () => {
        const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
        await config.update(INSTANCE_URL_KEY, url, vscode.ConfigurationTarget.Global);
      },
      catch: error => new Error(`Failed to set instanceUrl: ${String(error)}`)
    }),

  setAccessToken: (token: string) =>
    Effect.tryPromise({
      try: async () => {
        const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
        await config.update(ACCESS_TOKEN_KEY, token, vscode.ConfigurationTarget.Global);
      },
      catch: error => new Error(`Failed to set accessToken: ${String(error)}`)
    }),

  setApiVersion: (version: string) =>
    Effect.tryPromise({
      try: async () => {
        const config = vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION);
        await config.update(API_VERSION_KEY, version, vscode.ConfigurationTarget.Global);
      },
      catch: error => new Error(`Failed to set apiVersion: ${String(error)}`)
    })
});
