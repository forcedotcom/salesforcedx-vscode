/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { SettingsError, SettingsService } from '../../../src/vscode/settingsService';

const runAccessToken = () =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const settings = yield* SettingsService;
      return yield* settings.getAccessToken();
    }).pipe(Effect.provide(SettingsService.Default))
  );

const runApiVersion = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const settings = yield* SettingsService;
      return yield* settings.getApiVersion();
    }).pipe(Effect.provide(SettingsService.Default))
  );

describe('SettingsService.getAccessToken', () => {
  const originalPlatform = process.env.ESBUILD_PLATFORM;
  let getConfigSpy: jest.SpyInstance;

  beforeEach(() => {
    getConfigSpy = jest.spyOn(vscode.workspace, 'getConfiguration');
  });

  afterEach(() => {
    if (originalPlatform === undefined) {
      delete process.env.ESBUILD_PLATFORM;
    } else {
      process.env.ESBUILD_PLATFORM = originalPlatform;
    }
    getConfigSpy.mockRestore();
  });

  it('returns the managed-token sentinel in web mode without reading settings', async () => {
    process.env.ESBUILD_PLATFORM = 'web';

    const exit = await runAccessToken();

    expect(exit._tag).toBe('Success');
    if (exit._tag === 'Success') {
      expect(exit.value).toBe('web-console-managed-token');
    }
    expect(getConfigSpy).not.toHaveBeenCalled();
  });

  it('reads from settings and trims whitespace in desktop mode', async () => {
    delete process.env.ESBUILD_PLATFORM;

    getConfigSpy.mockReturnValue({
      get: jest.fn().mockReturnValue('  real-desktop-token  '),
      update: jest.fn()
    } as unknown as vscode.WorkspaceConfiguration);

    const exit = await runAccessToken();

    expect(exit._tag).toBe('Success');
    if (exit._tag === 'Success') {
      expect(exit.value).toBe('real-desktop-token');
    }
    expect(getConfigSpy).toHaveBeenCalledWith('salesforce-web-console');
  });

  it('fails with SettingsError in desktop mode when the setting is empty', async () => {
    delete process.env.ESBUILD_PLATFORM;

    getConfigSpy.mockReturnValue({
      get: jest.fn().mockReturnValue(''),
      update: jest.fn()
    } as unknown as vscode.WorkspaceConfiguration);

    const exit = await runAccessToken();

    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      const failure = Option.getOrThrow(Cause.failureOption(exit.cause));
      expect(failure).toBeInstanceOf(SettingsError);
      expect((failure as SettingsError)._tag).toBe('MissingSettingsError');
      expect((failure as SettingsError).key).toBe('accessToken');
    }
  });
});

describe('SettingsService.getApiVersion fallback', () => {
  let getConfigSpy: jest.SpyInstance;

  beforeEach(() => {
    getConfigSpy = jest.spyOn(vscode.workspace, 'getConfiguration');
  });

  afterEach(() => {
    getConfigSpy.mockRestore();
  });

  it('falls back to 67.0 when no value is configured', async () => {
    getConfigSpy.mockReturnValue({
      get: jest.fn().mockReturnValue(undefined),
      update: jest.fn()
    } as unknown as vscode.WorkspaceConfiguration);

    expect(await runApiVersion()).toBe('67.0');
  });

  it('falls back to 67.0 for an empty configured value', async () => {
    getConfigSpy.mockReturnValue({
      get: jest.fn().mockReturnValue(''),
      update: jest.fn()
    } as unknown as vscode.WorkspaceConfiguration);

    expect(await runApiVersion()).toBe('67.0');
  });
});
