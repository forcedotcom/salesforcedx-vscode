/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { FsProvider } from '../../../src/virtualFsProvider/fsTypes';
import { projectFiles } from '../../../src/virtualFsProvider/projectInit';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

const projectUri = URI.parse('memfs:/dx-project');

const workspaceLayer = Layer.succeed(
  WorkspaceService,
  new WorkspaceService({
    getWorkspaceInfo: () =>
      Effect.succeed({
        uri: URI.parse(''),
        path: '',
        fsPath: '',
        isEmpty: true,
        isVirtualFs: true,
        cwd: '/'
      })
  } as unknown as WorkspaceService)
);

const createFsProvider = (projectExists: boolean) => {
  const createDirectory = jest.fn().mockResolvedValue(undefined);
  const writeFile = jest.fn().mockResolvedValue(undefined);
  const provider = {
    exists: jest.fn((uri: URI) => projectExists && uri.toString() === `${projectUri.toString()}/sfdx-project.json`),
    createDirectory,
    writeFile,
    readDirectory: jest.fn().mockReturnValue([])
  } as unknown as FsProvider;

  return { provider, createDirectory, writeFile };
};

const runProjectFiles = (provider: FsProvider): Promise<void> =>
  Effect.runPromise(projectFiles(provider).pipe(Effect.provide(workspaceLayer)));

describe('projectFiles', () => {
  it('creates the default Web Console project without Prettier files', async () => {
    const { provider, writeFile } = createFsProvider(false);

    await runProjectFiles(provider);

    expect(writeFile.mock.calls.map(([uri]) => uri.toString()).toSorted()).toEqual([
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
    ]);
    expect(writeFile.mock.calls.map(([, , options]) => options)).toEqual(
      Array.from({ length: 10 }, () => ({ create: true, overwrite: true }))
    );
  });

  it('does not overwrite an existing project', async () => {
    const { provider, createDirectory, writeFile } = createFsProvider(true);

    await runProjectFiles(provider);

    expect(createDirectory).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
