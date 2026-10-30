/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SettingsService, WebSessionContextSchema } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Redacted from 'effect/Redacted';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { SettingsServiceLayer } from '../../src/settingsService.js';

const provide = <A, E>(program: Effect.Effect<A, E, SettingsService>) =>
  Effect.runPromise(program.pipe(Effect.provide(SettingsServiceLayer)));
const configuration = (value: unknown, update = vi.fn().mockResolvedValue(undefined)) => {
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    get: vi.fn().mockReturnValue(value),
    update
  } as unknown as vscode.WorkspaceConfiguration);
  return update;
};

it('trims access tokens but keeps their value redacted', async () => {
  configuration(' bearer-secret ');
  const token = await provide(SettingsService.use(service => service.getAccessToken()));
  expect(Redacted.value(token)).toBe('bearer-secret');
  expect(String(token)).toBe('<redacted>');
});

it.each([undefined, null, '', 42])('retains API version fallback for %j', async value => {
  configuration(value);
  expect(await provide(SettingsService.use(service => service.getApiVersion()))).toBe('67.0');
});

it('preserves configured API version and generic falsy values', async () => {
  configuration('63.0');
  expect(await provide(SettingsService.use(service => service.getApiVersion()))).toBe('63.0');
  for (const value of [false, 0, '']) {
    configuration(value);
    expect(await provide(SettingsService.use(service => service.getValueOrElse('section', 'key', 'fallback')))).toBe(
      value
    );
  }
});

it('keeps tolerant session identity decoding without coercing malformed flags', () => {
  expect(
    Schema.decodeUnknownSync(WebSessionContextSchema)({
      username: ' user@example.com ',
      orgId: ' ',
      userId: 42,
      namespacePrefix: '',
      isDevHub: true,
      isScratch: 'false',
      isSandbox: undefined
    })
  ).toEqual({ username: 'user@example.com', namespacePrefix: '', isDevHub: true, isScratch: false, isSandbox: false });
});

it('defaults malformed sessions and retains nullable/malformed setting error channels', async () => {
  configuration(undefined);
  expect(await provide(SettingsService.use(service => service.getSessionContext()))).toEqual({
    isDevHub: false,
    isScratch: false,
    isSandbox: false
  });
  configuration(42);
  expect(await provide(SettingsService.use(service => service.getInstanceUrl()).pipe(Effect.flip))).toMatchObject({
    _tag: 'MissingSettingsError',
    key: 'instanceUrl',
    section: 'salesforce-web-console'
  });
});

it('preserves specialized update targets and error messages', async () => {
  const update = configuration('');
  await provide(SettingsService.use(service => service.setInstanceUrl('https://example.com')));
  expect(update).toHaveBeenCalledWith('instanceUrl', 'https://example.com', vscode.ConfigurationTarget.Global);
  update.mockRejectedValueOnce(new Error('read only'));
  expect(
    await provide(SettingsService.use(service => service.setAccessToken('secret')).pipe(Effect.flip))
  ).toMatchObject({
    _tag: 'MissingSettingsError',
    key: 'accessToken',
    message: 'Failed to set access token: read only'
  });
});
