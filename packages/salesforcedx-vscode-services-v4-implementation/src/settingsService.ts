/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SettingsError, SettingsService, WebSessionContextSchema } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Redacted from 'effect/Redacted';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { unknownToErrorCause } from './errorCause.js';

const webSection = 'salesforce-web-console';
const coreSection = 'salesforcedx-vscode-core';
const defaultSession = Schema.decodeUnknownSync(WebSessionContextSchema)({});

const settingsError = (cause: unknown, section: string, key: string, message: string): SettingsError => {
  const { cause: error, message: causeMessage } = unknownToErrorCause(cause);
  return new SettingsError({ cause: error, section, key, message: `${message}: ${causeMessage}` });
};

/** Reads and writes the host configuration; access tokens leave only as Redacted values. */
export const SettingsServiceLayer = Layer.effect(
  SettingsService,
  Effect.sync(() => {
    const readValue = <T>(section: string, key: string) =>
      Effect.try({
        try: () => vscode.workspace.getConfiguration(section).get<T>(key),
        catch: cause => settingsError(cause, section, key, `Failed to get setting ${section}.${key}`)
      });
    const getValue = Effect.fn('SettingsService.getValue')(<T>(section: string, key: string) =>
      readValue<T>(section, key)
    );
    const getValueOrElse = Effect.fn('SettingsService.getValueOrElse')(
      <T>(section: string, key: string, defaultValue: T) =>
        readValue<T>(section, key).pipe(Effect.map(value => value ?? defaultValue))
    );
    const setValue = Effect.fn('SettingsService.setValue')(
      <T>(section: string, key: string, value: T, target = vscode.ConfigurationTarget.Global) =>
        Effect.tryPromise({
          try: () => Promise.resolve(vscode.workspace.getConfiguration(section).update(key, value, target)),
          catch: cause => settingsError(cause, section, key, `Failed to set setting ${section}.${key}`)
        })
    );
    const nonEmpty = (key: string) => (value: string | undefined) =>
      Effect.succeed(value).pipe(
        Effect.filterOrFail(
          Schema.is(Schema.NonEmptyString),
          () =>
            new SettingsError({
              cause: new Error(`Value for ${key} is empty`),
              key,
              message: `Value for ${key} is empty`
            })
        )
      );
    const readWebSetting = <A>(key: string, label: string, read: (configuration: vscode.WorkspaceConfiguration) => A) =>
      Effect.try({
        try: () => read(vscode.workspace.getConfiguration(webSection)),
        catch: cause => settingsError(cause, webSection, key, `Failed to get ${label}`)
      });
    const updateWebSetting = (key: string, label: string, value: string) =>
      Effect.tryPromise({
        try: () =>
          Promise.resolve(
            vscode.workspace.getConfiguration(webSection).update(key, value, vscode.ConfigurationTarget.Global)
          ),
        catch: cause => settingsError(cause, webSection, key, `Failed to set ${label}`)
      });
    const getInstanceUrl = Effect.fn('SettingsService.getInstanceUrl')(() =>
      readWebSetting('instanceUrl', 'instance URL', config => config.get<string>('instanceUrl')?.trim()).pipe(
        Effect.flatMap(nonEmpty('instanceUrl'))
      )
    );
    const getAccessToken = Effect.fn('SettingsService.getAccessToken')(() =>
      readWebSetting('accessToken', 'access token', config => config.get<string>('accessToken')?.trim()).pipe(
        Effect.flatMap(nonEmpty('accessToken')),
        Effect.map(Redacted.make)
      )
    );
    const getApiVersion = Effect.fn('SettingsService.getApiVersion')(() =>
      readWebSetting('apiVersion', 'API version', config => {
        const value = config.get<string>('apiVersion') ?? '67.0';
        return value.length > 0 ? value : '67.0';
      })
    );
    const getSessionContext = Effect.fn('SettingsService.getSessionContext')(() =>
      getValue<unknown>(webSection, 'sessionContext').pipe(
        Effect.map(value =>
          Option.getOrElse(Schema.decodeUnknownOption(WebSessionContextSchema)(value), () => defaultSession)
        )
      )
    );
    return SettingsService.of({
      getValue,
      getValueOrElse,
      setValue,
      getInstanceUrl,
      getAccessToken,
      getApiVersion,
      getSessionContext,
      setInstanceUrl: Effect.fn('SettingsService.setInstanceUrl')((value: string) =>
        updateWebSetting('instanceUrl', 'instance URL', value)
      ),
      setAccessToken: Effect.fn('SettingsService.setAccessToken')((value: string) =>
        updateWebSetting('accessToken', 'access token', value)
      ),
      setApiVersion: Effect.fn('SettingsService.setApiVersion')((value: string) =>
        updateWebSetting('apiVersion', 'API version', value)
      ),
      getRetrieveOnLoad: Effect.fn('SettingsService.getRetrieveOnLoad')(() =>
        readWebSetting(
          'retrieveOnLoad',
          'retrieve on load setting',
          config => config.get<string>('retrieveOnLoad')?.trim() ?? ''
        )
      ),
      getInternalDev: Effect.fn('SettingsService.getInternalDev')(() =>
        getValueOrElse(coreSection, 'internal-development', false)
      )
    });
  })
);
