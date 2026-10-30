/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfProject } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { FileChangePubSub, MetadataRegistryService, ProjectService } from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as TestClock from 'effect/testing/TestClock';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { FileChangePubSubLayer } from '../../src/changePubSubs.js';
import { MetadataRegistryServiceLayer } from '../../src/metadataRegistryService.js';
import { ProjectFileWatcherLayer } from '../../src/projectLayers.js';
import { ProjectServiceLayer } from '../../src/projectService.js';
import { WorkspaceServiceLayer } from '../../src/workspaceService.js';

const originalFs = coreFs.fs;
const directories: string[] = [];
const folders: vscode.WorkspaceFolder[] = [];
const base = Layer.mergeAll(ProjectServiceLayer, MetadataRegistryServiceLayer).pipe(
  Layer.provideMerge(Layer.mergeAll(WorkspaceServiceLayer, FileChangePubSubLayer))
);
const graph = ProjectFileWatcherLayer.pipe(Layer.provideMerge(base));
class ProjectA extends Context.Service<ProjectA, ProjectService['Service']>()('test/ProjectA') {}
class ProjectB extends Context.Service<ProjectB, ProjectService['Service']>()('test/ProjectB') {}

const selectFolder = (uri: URI) => folders.splice(0, folders.length, { uri, name: 'project', index: 0 });
const writeManifest = async (path: string, sourceApiVersion = '67.0') => {
  await coreFs.fs.promises.mkdir(Utils.joinPath(URI.file(path), 'force-app').fsPath, { recursive: true });
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(URI.file(path), 'sfdx-project.json').fsPath,
    JSON.stringify({
      packageDirectories: [{ path: 'force-app', default: true }],
      namespace: 'MyPackage',
      sourceApiVersion
    })
  );
};
const nodeProject = async () => {
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sf-v4-project-'));
  directories.push(directory);
  await writeManifest(directory);
  selectFolder(URI.file(directory));
  return directory;
};
beforeEach(() => {
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  vi.stubEnv('FORCE_MEMFS', 'false');
  coreFs.setFs(coreFs.getVirtualFs());
  SfProject.clearInstances();
  folders.splice(0);
  Object.defineProperty(vscode.workspace, 'workspaceFolders', { configurable: true, get: () => folders });
  vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  SfProject.clearInstances();
  coreFs.setFs(originalFs);
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

it.each(['node', 'memfs'])(
  'uses real SDK project/registry instances and namespace/folder contracts on %s',
  async backend => {
    vi.stubEnv('FORCE_MEMFS', backend === 'memfs' ? 'true' : 'false');
    vi.stubEnv('ESBUILD_PLATFORM', backend === 'memfs' ? 'web' : 'node');
    coreFs.setFs(coreFs.getVirtualFs());
    const directory = backend === 'node' ? await nodeProject() : '/v4-project-memory';
    if (backend === 'memfs') {
      await writeManifest(directory);
      selectFolder(URI.parse(`memfs:${directory}`));
    }
    const runtime = ManagedRuntime.make(graph);
    try {
      const project = await runtime.runPromise(ProjectService.use(service => service.getSfProject()));
      const registry = await runtime.runPromise(MetadataRegistryService.use(service => service.getRegistryAccess()));
      expect(project).toBeInstanceOf(SfProject);
      expect(registry).toBeInstanceOf(RegistryAccess);
      expect(registry.getTypeByName('ApexClass').suffix).toBe('cls');
      expect(await runtime.runPromise(ProjectService.use(service => service.getProjectNamespace()))).toBe('MyPackage');
      expect(
        await runtime.runPromise(
          ProjectService.use(service => service.isArtifactNamespaceWorkspaceEligible('mypackage'))
        )
      ).toBe(true);
      expect(
        await runtime.runPromise(ProjectService.use(service => service.isArtifactNamespaceWorkspaceEligible(null)))
      ).toBe(false);
      expect((await runtime.runPromise(ProjectService.use(service => service.getDebugLogsFolder()))).path).toBe(
        `${URI.file(directory).path}/.sfdx/tools/debug/logs`
      );
      expect(
        await runtime.runPromise(
          ProjectService.use(service =>
            service.isInPackageDirectories(Utils.joinPath(folders[0].uri, 'force-app', 'Foo.cls'))
          )
        )
      ).toBe(true);
      expect(
        await runtime.runPromise(
          ProjectService.use(service =>
            service.ensureInPackageDirectories([Utils.joinPath(folders[0].uri, 'outside', 'Foo.cls')])
          ).pipe(Effect.flip)
        )
      ).toMatchObject({ _tag: 'NotInPackageDirectoryError' });
    } finally {
      await runtime.dispose();
    }
  }
);

it('memoizes shared layers and SDK lookups without duplicate project-opened notifications', async () => {
  await nodeProject();
  const resolve = vi.spyOn(SfProject, 'resolve');
  const a = Layer.effect(ProjectA, ProjectService).pipe(Layer.provide(graph));
  const b = Layer.effect(ProjectB, ProjectService).pipe(Layer.provide(graph));
  const runtime = ManagedRuntime.make(Layer.mergeAll(graph, a, b));
  try {
    const [first, second] = await runtime.runPromise(Effect.all([ProjectA, ProjectB]));
    expect(first).toBe(second);
    const projects = await runtime.runPromise(
      Effect.all([first.getSfProject(), second.getSfProject()], { concurrency: 'unbounded' })
    );
    expect(projects[0]).toBe(projects[1]);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(vscode.commands.executeCommand).toHaveBeenCalledExactlyOnceWith('setContext', 'sf:project_opened', true);
  } finally {
    await runtime.dispose();
  }
});

it('invalidates both SDK and Effect project caches before publishing a root manifest edit', async () => {
  const directory = await nodeProject();
  const runtime = ManagedRuntime.make(graph);
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* ProjectService;
        const first = yield* service.getSfProject();
        expect(first.getSfProjectJson().getContents().sourceApiVersion).toBe('67.0');
        const nextEvent = yield* Stream.toPull(service.projectConfigChanges);
        yield* Effect.promise(() => writeManifest(directory, '68.0'));
        const events = yield* FileChangePubSub;
        yield* PubSub.publish(events, {
          type: 'change' as const,
          uri: Utils.joinPath(folders[0].uri, 'sfdx-project.json')
        });
        yield* nextEvent;
        const second = yield* service.getSfProject();
        expect(second).not.toBe(first);
        expect(second.getSfProjectJson().getContents().sourceApiVersion).toBe('68.0');
      }).pipe(Effect.scoped, Effect.timeout(Duration.seconds(2)))
    );
  } finally {
    await runtime.dispose();
  }
});

it.each(['Other.cls', 'sfdx-project.json'])(
  'preserves a root manifest edit followed by an unrelated force-app/%s event during debounce',
  async fileName => {
    const directory = await nodeProject();
    const runtime = ManagedRuntime.make(graph);
    try {
      await runtime.runPromise(
        Effect.gen(function* () {
          const service = yield* ProjectService;
          const first = yield* service.getSfProject();
          const nextEvent = yield* Stream.toPull(service.projectConfigChanges);
          yield* Effect.promise(() => writeManifest(directory, '68.0'));
          const events = yield* FileChangePubSub;
          const manifest = { type: 'change' as const, uri: Utils.joinPath(folders[0].uri, 'sfdx-project.json') };
          yield* PubSub.publish(events, manifest);
          yield* PubSub.publish(events, {
            type: 'change' as const,
            uri: Utils.joinPath(folders[0].uri, 'force-app', fileName)
          });
          expect(yield* nextEvent).toEqual([manifest]);
          const second = yield* service.getSfProject();
          expect(second).not.toBe(first);
          expect(second.getSfProjectJson().getContents().sourceApiVersion).toBe('68.0');
        }).pipe(Effect.scoped, Effect.timeout(Duration.seconds(2)))
      );
    } finally {
      await runtime.dispose();
    }
  }
);

it('keeps ten-minute success TTLs, immediate project-failure retries, and separate workspace registry entries', async () => {
  const directory = await nodeProject();
  const sibling = await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'sf-v4-project-sibling-'));
  directories.push(sibling);
  await writeManifest(sibling);
  const resolve = vi.spyOn(SfProject, 'resolve').mockRejectedValueOnce(new Error('temporary read failure'));
  await Effect.runPromise(
    Effect.gen(function* () {
      const project = yield* ProjectService;
      const registry = yield* MetadataRegistryService;
      expect((yield* project.getSfProject().pipe(Effect.flip))._tag).toBe('FailedToResolveSfProjectError');
      yield* project.getSfProject();
      const first = yield* registry.getRegistryAccess();
      yield* TestClock.adjust(Duration.minutes(9));
      expect(yield* registry.getRegistryAccess()).toBe(first);
      yield* project.getSfProject();
      expect(resolve).toHaveBeenCalledTimes(2);
      yield* TestClock.adjust(Duration.minutes(1));
      yield* project.getSfProject();
      expect(resolve).toHaveBeenCalledTimes(3);
      expect(yield* registry.getRegistryAccess()).not.toBe(first);
      selectFolder(URI.file(sibling));
      const other = yield* registry.getRegistryAccess();
      selectFolder(URI.file(directory));
      expect(yield* registry.getRegistryAccess()).not.toBe(other);
    }).pipe(Effect.provide(graph), Effect.provide(TestClock.layer()))
  );
});

it('rejects retained service calls after disposal and clears the SDK project singleton for the next owner', async () => {
  await nodeProject();
  const firstRuntime = ManagedRuntime.make(graph);
  const service = await firstRuntime.runPromise(ProjectService);
  const first = await firstRuntime.runPromise(service.getSfProject());
  await firstRuntime.dispose();
  expect(Exit.isFailure(await Effect.runPromiseExit(service.getSfProject()))).toBe(true);
  const secondRuntime = ManagedRuntime.make(graph);
  try {
    expect(await secondRuntime.runPromise(ProjectService.use(next => next.getSfProject()))).not.toBe(first);
  } finally {
    await secondRuntime.dispose();
  }
});
