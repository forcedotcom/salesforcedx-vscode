/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { StateAggregator } from '@salesforce/core';
import { AliasService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { AliasServiceLayer } from '../../src/aliasService.js';
import { FsServiceLayer } from '../../src/fsService.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';

const graph = AliasServiceLayer.pipe(
  Layer.provide(FsServiceLayer.pipe(Layer.provide(Layer.succeed(WebFileSystemProvider, { get: () => undefined }))))
);
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

it('reads aliases fresh from disk and retains username lookup/fallback behavior', async () => {
  vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
    bytes({ orgs: { primary: 'user', secondary: 'user', other: 'else' } })
  );
  const runtime = ManagedRuntime.make(graph);
  try {
    expect(await runtime.runPromise(AliasService.use(service => service.getAliasesFromUsername('user')))).toEqual([
      'primary',
      'secondary'
    ]);
    expect(await runtime.runPromise(AliasService.use(service => service.getUsernameFromAlias('primary')))).toEqual(
      Option.some('user')
    );
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(bytes({ orgs: { renamed: 'user' } }));
    expect(await runtime.runPromise(AliasService.use(service => service.getAllAliases()))).toEqual({ renamed: 'user' });
    expect(await runtime.runPromise(AliasService.use(service => service.getUsernameFromAlias('primary')))).toEqual(
      Option.none()
    );
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(bytes({ orgs: { invalid: 42 } }));
    expect(
      await runtime.runPromise(AliasService.use(service => service.getAllAliases()).pipe(Effect.flip))
    ).toMatchObject({ _tag: 'FsServiceError' });
    expect(await runtime.runPromise(AliasService.use(service => service.getAliasesFromUsername('user')))).toEqual([]);
    expect(await runtime.runPromise(AliasService.use(service => service.getUsernameFromAlias('invalid')))).toEqual(
      Option.none()
    );
  } finally {
    await runtime.dispose();
  }
});

it('keeps alias removal idempotent and continues after an already-removed alias', async () => {
  const unsetAndSave = vi
    .fn<StateAggregator['aliases']['unsetAndSave']>()
    .mockRejectedValueOnce(new Error('already removed'))
    .mockResolvedValue(undefined);
  vi.spyOn(StateAggregator, 'getInstance').mockResolvedValue({
    aliases: { unsetAndSave }
  } as unknown as StateAggregator);
  const runtime = ManagedRuntime.make(graph);
  try {
    await runtime.runPromise(AliasService.use(service => service.unsetAliases(['removed', 'present'])));
    expect(unsetAndSave.mock.calls.map(([alias]) => alias)).toEqual(['removed', 'present']);
  } finally {
    await runtime.dispose();
  }
});
