/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import { SfProject } from '@salesforce/core';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  canonicalProjectNamespace,
  isWorkspaceNamespaceEligible,
  ProjectService,
  setProjectOpenedContext
} from '../../../src/core/projectService';
import { NoWorkspaceOpenError, WorkspaceService } from '../../../src/vscode/workspaceService';

const workspaceInfo = (uri: URI) => ({
  uri,
  path: uri.toString(),
  fsPath: uri.fsPath,
  isEmpty: false as const,
  isVirtualFs: uri.scheme !== 'file',
  cwd: uri.fsPath
});

const workspaceLayer = (uri: URI | undefined) =>
  Layer.succeed(
    WorkspaceService,
    new WorkspaceService({
      getWorkspaceInfo: () =>
        uri
          ? Effect.succeed(workspaceInfo(uri))
          : Effect.succeed({
              uri: URI.parse(''),
              path: '',
              fsPath: '',
              isEmpty: true as const,
              isVirtualFs: false,
              cwd: ''
            }),
      getWorkspaceInfoOrThrow: () =>
        uri
          ? Effect.succeed(workspaceInfo(uri))
          : Effect.fail(new NoWorkspaceOpenError({ message: 'No workspace is currently open' }))
    } as unknown as WorkspaceService)
  );

const layerFor = (uri: URI | undefined) =>
  Layer.provide(ProjectService.DefaultWithoutDependencies, workspaceLayer(uri));

const pathOf = (folder: 'getStateFolder' | 'getDebugLogsFolder' | 'getApexTestResultsFolder', uri: URI) =>
  Effect.runPromise(Effect.map(ProjectService[folder](), result => result.path).pipe(Effect.provide(layerFor(uri))));

describe('ProjectService folder URIs', () => {
  const workspace = URI.file('/project');

  it('getStateFolder is the workspace .sfdx folder', async () => {
    expect(await pathOf('getStateFolder', workspace)).toBe('/project/.sfdx');
  });

  it('getDebugLogsFolder is .sfdx/tools/debug/logs', async () => {
    expect(await pathOf('getDebugLogsFolder', workspace)).toBe('/project/.sfdx/tools/debug/logs');
  });

  it('getApexTestResultsFolder is .sfdx/tools/testresults/apex', async () => {
    expect(await pathOf('getApexTestResultsFolder', workspace)).toBe('/project/.sfdx/tools/testresults/apex');
  });

  it('works for a virtual (memfs) workspace', async () => {
    expect(await pathOf('getDebugLogsFolder', URI.parse('memfs:/dx-project'))).toBe(
      '/dx-project/.sfdx/tools/debug/logs'
    );
  });

  it.each(['getStateFolder', 'getDebugLogsFolder', 'getApexTestResultsFolder'] as const)(
    '%s fails with NoWorkspaceOpenError when no workspace is open',
    async folder => {
      const exit = await Effect.runPromiseExit(ProjectService[folder]().pipe(Effect.provide(layerFor(undefined))));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(Exit.isFailure(exit) ? Option.getOrUndefined(Cause.failureOption(exit.cause)) : undefined).toBeInstanceOf(
        NoWorkspaceOpenError
      );
    }
  );
});

describe('ProjectService opened context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates VS Code only when the project-opened value changes', async () => {
    const previousValue = await Effect.runPromise(Ref.make<boolean | undefined>(undefined));

    await Effect.runPromise(setProjectOpenedContext(previousValue, true, 'workspace_non_empty'));
    await Effect.runPromise(setProjectOpenedContext(previousValue, true, 'workspace_non_empty'));
    await Effect.runPromise(setProjectOpenedContext(previousValue, false, 'workspace_empty'));

    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(1, 'setContext', 'sf:project_opened', true);
    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(2, 'setContext', 'sf:project_opened', false);
    expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
  });
});

describe('ProjectService namespace', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['MyPackage', 'MyPackage'],
    ['  MyPackage  ', 'MyPackage'],
    ['', null],
    ['   ', null],
    [undefined, null],
    [42, null]
  ])('normalizes project namespace %p to %p', (value, expected) => {
    expect(canonicalProjectNamespace(value)).toBe(expected);
  });

  it.each([
    ['MyPackage', 'mypackage', true],
    [null, null, true],
    ['MyPackage', null, false],
    [null, 'MyPackage', false],
    ['MyPackage', 'OtherPackage', false]
  ] as const)(
    'evaluates requested namespace %p against project namespace %p',
    (requestedNamespace, projectNamespace, expected) => {
      expect(isWorkspaceNamespaceEligible(requestedNamespace, projectNamespace)).toBe(expected);
    }
  );

  it('reads canonical namespace casing through ProjectService', async () => {
    vi.spyOn(SfProject, 'resolve').mockResolvedValue({
      getSfProjectJson: () => ({ getContents: () => ({ namespace: 'MyPackage' }) })
    } as unknown as SfProject);

    const namespace = await Effect.runPromise(
      ProjectService.getProjectNamespace().pipe(Effect.provide(layerFor(URI.file('/project-namespace'))))
    );

    expect(namespace).toBe('MyPackage');
  });

  it('reports a missing Salesforce project as a typed resolution failure', async () => {
    vi.spyOn(SfProject, 'resolve').mockRejectedValue(new Error('not a Salesforce project'));

    const exit = await Effect.runPromiseExit(
      ProjectService.getProjectNamespace().pipe(Effect.provide(layerFor(URI.file('/missing-project-namespace'))))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(Exit.isFailure(exit) ? Option.getOrUndefined(Cause.failureOption(exit.cause)) : undefined).toMatchObject({
      _tag: 'FailedToResolveSfProjectError'
    });
  });
});

describe('ProjectService.isInPackageDirectories', () => {
  const posixWorkspace = URI.file('/w24232208-posix-pkg');
  const windowsWorkspace = URI.file('/w24232208-windows-pkg');

  beforeEach(() => {
    jest.spyOn(SfProject, 'resolve').mockImplementation(
      async (fsPath?: string) =>
        ({
          getPackageDirectories: () =>
            fsPath?.includes('w24232208-windows-pkg') ? [{ fullPath: 'C:/Force-App' }] : [{ fullPath: '/force-app' }]
        }) as unknown as SfProject
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const contained = (workspace: URI, uri: URI) =>
    Effect.runPromise(ProjectService.isInPackageDirectories(uri).pipe(Effect.provide(layerFor(workspace))));

  it('keeps posix package directories case-sensitive', async () => {
    await expect(contained(posixWorkspace, URI.file('/force-app/classes/Foo.cls'))).resolves.toBe(true);
    await expect(contained(posixWorkspace, URI.file('/Force-app/classes/Foo.cls'))).resolves.toBe(false);
    await expect(contained(posixWorkspace, URI.file('/other/Foo.cls'))).resolves.toBe(false);
  });

  it('treats Windows drive package directories as case-insensitive', async () => {
    await expect(contained(windowsWorkspace, URI.parse('file:///c:/force-app/classes/Foo.cls'))).resolves.toBe(true);
    await expect(contained(windowsWorkspace, URI.parse('file:///C:/FORCE-APP/classes/Foo.cls'))).resolves.toBe(true);
    await expect(contained(windowsWorkspace, URI.parse('file:///c:/other/Foo.cls'))).resolves.toBe(false);
  });
});
