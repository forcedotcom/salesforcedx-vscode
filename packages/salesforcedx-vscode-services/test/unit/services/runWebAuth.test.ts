/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { setImmediate } from 'node:timers/promises';
import * as vscode from 'vscode';
import { runWebAuthEffect } from '../../../src/vscode/runWebAuth';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it('awaits development web configuration updates before bootstrap can continue', async () => {
  vi.stubEnv(
    'ESBUILD_WEB_CONFIG',
    '{"salesforce-web-console.instanceUrl":"https://example.test","salesforce-web-console.accessToken":"token"}'
  );
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const update = vi.fn(() => {
    started.resolve();
    return release.promise;
  });
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    update
  } as unknown as vscode.WorkspaceConfiguration);
  let finished = false;
  const applying = Effect.runPromise(runWebAuthEffect()).then(() => {
    finished = true;
  });
  await started.promise;
  await setImmediate();
  expect(finished).toBe(false);
  release.resolve();
  await applying;
  expect(update.mock.calls).toEqual([
    ['salesforce-web-console.instanceUrl', 'https://example.test', vscode.ConfigurationTarget.Workspace],
    ['salesforce-web-console.accessToken', 'token', vscode.ConfigurationTarget.Workspace]
  ]);
});
it('rejects malformed injected configuration without applying partial updates', async () => {
  vi.stubEnv('ESBUILD_WEB_CONFIG', '["not a configuration map"]');
  const update = vi.fn();
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    update
  } as unknown as vscode.WorkspaceConfiguration);
  expect(await Effect.runPromise(runWebAuthEffect().pipe(Effect.flip))).toMatchObject({ _tag: 'SchemaError' });
  expect(update).not.toHaveBeenCalled();
});
