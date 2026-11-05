/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { setImmediate } from 'node:timers/promises';
import { type FsProvider } from '../../../src/virtualFsProvider/fsTypes';
import { projectFiles } from '../../../src/virtualFsProvider/projectInit';
import { WorkspaceService } from '@salesforce/vscode-services/v2';

const projectUri = URI.parse('memfs:/dx-project');

const workspaceLayer = Layer.mock(WorkspaceService, {
  getWorkspaceInfo: () =>
    Effect.succeed({
      uri: URI.parse(''),
      path: '',
      fsPath: '',
      isEmpty: true,
      isVirtualFs: true,
      cwd: '/'
    })
});

const createFsProvider = (projectExists: boolean) => {
  const createDirectory = vi.fn().mockResolvedValue(undefined);
  const writeFile = vi.fn().mockResolvedValue(undefined);
  const provider = {
    exists: vi.fn((uri: URI) => projectExists && uri.toString() === `${projectUri.toString()}/sfdx-project.json`),
    createDirectory,
    writeFile,
    readDirectory: vi.fn().mockReturnValue([])
  } as unknown as FsProvider;

  return { provider, createDirectory, writeFile };
};

const runProjectFiles = (provider: FsProvider): Promise<void> =>
  Effect.runPromise(projectFiles(provider).pipe(Effect.provide(workspaceLayer)));

describe('projectFiles', () => {
  it('creates the default Web Console project without Prettier files', async () => {
    const { provider, writeFile } = createFsProvider(false);

    await runProjectFiles(provider);

    const expectedPaths = [
      'memfs:/dx-project/.forceignore',
      'memfs:/dx-project/.gitignore',
      'memfs:/dx-project/.vscode/launch.json',
      'memfs:/dx-project/.vscode/mcp.json',
      'memfs:/dx-project/.vscode/settings.json',
      'memfs:/dx-project/.vscode/tasks.json',
      'memfs:/dx-project/README.md',
      'memfs:/dx-project/jest.config.js',
      'memfs:/dx-project/sfdx-project.json',
      'memfs:/dx-project/tsconfig.json'
    ];
    expect(writeFile.mock.calls.map(([uri]) => uri.toString()).toSorted()).toEqual(expectedPaths);
    expect(writeFile.mock.calls.map(([, , options]) => options)).toEqual(
      expectedPaths.map(() => ({ create: true, overwrite: true }))
    );
  });

  it('does not overwrite an existing project', async () => {
    const { provider, createDirectory, writeFile } = createFsProvider(true);

    await runProjectFiles(provider);

    expect(createDirectory).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('does not complete initialization before native file writes settle', async () => {
    const { provider, writeFile } = createFsProvider(false);
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    writeFile.mockImplementation(() => {
      started.resolve();
      return release.promise;
    });
    let finished = false;
    const initializing = runProjectFiles(provider).then(() => {
      finished = true;
    });
    await started.promise;
    await setImmediate();
    expect(finished).toBe(false);
    release.resolve();
    await initializing;
    expect(writeFile).toHaveBeenCalledTimes(10);
  });

  it('reports rejected file writes as initialization failures', async () => {
    const { provider, writeFile } = createFsProvider(false);
    const cause = new Error('write denied');
    writeFile.mockRejectedValueOnce(cause);
    const failure = await Effect.runPromise(projectFiles(provider).pipe(Effect.provide(workspaceLayer), Effect.flip));
    expect(failure).toMatchObject({ _tag: 'VirtualFsProviderError', message: 'write denied', cause });
  });

  it('joins started native writes when initialization is cancelled', async () => {
    const { provider, writeFile } = createFsProvider(false);
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    writeFile.mockImplementation(() => {
      started.resolve();
      return release.promise;
    });
    const controller = new AbortController();
    let finished = false;
    const initializing = Effect.runPromiseExit(projectFiles(provider).pipe(Effect.provide(workspaceLayer)), {
      signal: controller.signal
    }).then(outcome => {
      finished = true;
      return outcome;
    });
    await started.promise;
    controller.abort();
    await setImmediate();
    expect(finished).toBe(false);
    release.resolve();
    const result = await initializing;
    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') expect(result.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
  });
});
