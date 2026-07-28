/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OrgDataFsProvider } from '../../src/orgVfs/orgDataFsProvider';
import { FsService } from '../../src/vscode/fsService';
import {
  FileSystemProviderRegistry,
  makeFileSystemProviderRegistry
} from '../../src/virtualFsProvider/fileSystemProviderRegistry';

(vscode as typeof vscode & { FileChangeType: Record<string, number> }).FileChangeType ??= {
  Changed: 1,
  Created: 2,
  Deleted: 3
};

const relativePattern = (baseUri: URI, pattern: string): vscode.RelativePattern =>
  ({ baseUri, pattern }) as vscode.RelativePattern;

const makeHarness = () => {
  const registry = makeFileSystemProviderRegistry();
  const provider = new OrgDataFsProvider();
  registry.register('sf-org-data', { provider });
  const layer = FsService.Default.pipe(Layer.provide(Layer.succeed(FileSystemProviderRegistry, registry)));
  const run = <A, E>(effect: Effect.Effect<A, E, FsService>) => Effect.runPromise(effect.pipe(Effect.provide(layer)));
  return { registry, provider, run };
};

describe('FsService.findFiles dispatch', () => {
  afterEach(() => jest.restoreAllMocks());

  it('delegates file URIs to workspace.findFiles', async () => {
    const { run } = makeHarness();
    const expected = [URI.file('/workspace/Test.cls')];
    const findFiles = jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue(expected);
    const include = relativePattern(URI.file('/workspace'), '**/*.cls');

    await expect(run(FsService.findFiles(include))).resolves.toEqual(expected);
    expect(findFiles).toHaveBeenCalledWith(include, undefined, undefined, undefined);
  });

  it('delegates memfs URIs to the registered provider capability', async () => {
    const { registry, run } = makeHarness();
    const expected = [URI.parse('memfs:/workspace/Test.cls')];
    const findFiles = jest.fn().mockResolvedValue(expected);
    registry.register('memfs', { provider: {} as vscode.FileSystemProvider, findFiles });
    const include = relativePattern(URI.parse('memfs:/workspace'), '**/*.cls');

    await expect(run(FsService.findFiles(include, '**/*.test.cls', 10))).resolves.toEqual(expected);
    expect(findFiles).toHaveBeenCalledWith(include, '**/*.test.cls', 10);
  });

  it('walks org-data recursively, applies excludes, and honors maxResults', async () => {
    const { provider, run } = makeHarness();
    const base = URI.parse('sf-org-data:/orgs/00d/metadata-preview');
    const classes = URI.parse('sf-org-data:/orgs/00d/metadata-preview/classes');
    const namespace = URI.parse('sf-org-data:/orgs/00d/metadata-preview/classes/ns');
    provider.createDirectoryInternal(namespace);
    provider.writeFileInternal(URI.parse(`${classes.toString()}/First.cls`), new Uint8Array(), {
      create: true,
      overwrite: true
    });
    provider.writeFileInternal(URI.parse(`${namespace.toString()}/Second.cls`), new Uint8Array(), {
      create: true,
      overwrite: true
    });
    provider.writeFileInternal(URI.parse(`${namespace.toString()}/Ignored.txt`), new Uint8Array(), {
      create: true,
      overwrite: true
    });
    jest.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async uri => provider.readDirectory(uri));

    const result = await run(FsService.findFiles(relativePattern(base, '**/*'), '**/*.txt', 2));
    const truncated = await run(FsService.findFiles(relativePattern(base, '**/*.cls'), undefined, 1));

    expect(result).toHaveLength(2);
    expect(result.every(uri => uri.path.endsWith('.cls'))).toBe(true);
    expect(truncated).toHaveLength(1);
  });

  it('stops an org-data walk when cancelled', async () => {
    const { provider, run } = makeHarness();
    const base = URI.parse('sf-org-data:/orgs/00d/metadata-preview');
    provider.createDirectoryInternal(base);
    const readDirectory = jest.spyOn(vscode.workspace.fs, 'readDirectory');
    const token = { isCancellationRequested: true } as vscode.CancellationToken;

    await expect(run(FsService.findFiles(relativePattern(base, '**/*'), undefined, undefined, token))).resolves.toEqual(
      []
    );
    expect(readDirectory).not.toHaveBeenCalled();
  });

  it('fails for an unsupported scheme', async () => {
    const { run } = makeHarness();

    await expect(run(FsService.findFiles(relativePattern(URI.parse('unknown:/workspace'), '**/*')))).rejects.toThrow(
      'findFiles does not support scheme unknown'
    );
  });

  it('fails when a string pattern has no workspace folder', async () => {
    const { run } = makeHarness();
    const originalFolders = vscode.workspace.workspaceFolders;
    (vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = undefined;

    await expect(run(FsService.findFiles('**/*'))).rejects.toThrow(
      'Cannot find files without a workspace folder or RelativePattern base URI'
    );

    (vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
  });
});
