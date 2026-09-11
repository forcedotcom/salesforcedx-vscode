/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Redacted from 'effect/Redacted';
import * as vscode from 'vscode';
import { SettingsService } from '../../../src/vscode/settingsService';

const FALLBACK_API_VERSION = '67.0';

const mockGetConfiguration = (value: string | undefined): void => {
  jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    get: () => value,
    update: jest.fn()
  } as unknown as vscode.WorkspaceConfiguration);
};

const runGetApiVersion = (): Promise<string> =>
  Effect.runPromise(SettingsService.getApiVersion().pipe(Effect.provide(SettingsService.Default)));

const runGetAccessToken = () =>
  Effect.runPromise(SettingsService.getAccessToken().pipe(Effect.provide(SettingsService.Default)));

describe('SettingsService.getAccessToken', () => {
  it('returns the trimmed token as a redacted value', async () => {
    mockGetConfiguration(' access-token ');

    const accessToken = await runGetAccessToken();

    expect(String(accessToken)).toBe('<redacted>');
    expect(Redacted.value(accessToken)).toBe('access-token');
  });
});

describe('SettingsService.getApiVersion', () => {
  it('falls back to 67.0 when the setting is unset', async () => {
    mockGetConfiguration(undefined);
    expect(await runGetApiVersion()).toBe(FALLBACK_API_VERSION);
  });

  it('falls back to 67.0 when the setting is an empty string', async () => {
    mockGetConfiguration('');
    expect(await runGetApiVersion()).toBe(FALLBACK_API_VERSION);
  });

  it('returns the configured value when set', async () => {
    mockGetConfiguration('63.0');
    expect(await runGetApiVersion()).toBe('63.0');
  });
});
