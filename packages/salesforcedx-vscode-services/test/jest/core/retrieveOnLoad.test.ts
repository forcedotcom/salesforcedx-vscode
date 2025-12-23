/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentStatus, type FileResponse, type FileResponseSuccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { parseRetrieveOnLoad, filterFileResponses } from '../../../src/core/retrieveOnLoad';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

/** Create a test layer for WorkspaceService with a mock workspace path */
const createMockWorkspaceService = (workspacePath: string): Layer.Layer<WorkspaceService, never, never> => {
  const workspaceInfo = {
    path: `file://${workspacePath}`,
    fsPath: workspacePath,
    isEmpty: false as const,
    isVirtualFs: false,
    cwd: workspacePath
  };
  return Layer.succeed(
    WorkspaceService,
    new WorkspaceService({
      getWorkspaceInfo: Effect.succeed(workspaceInfo),
      getWorkspaceInfoOrThrow: Effect.succeed(workspaceInfo)
    })
  );
};

const createFileResponse = (
  type: string,
  fullName: string,
  filePath: string,
  state: Exclude<ComponentStatus, ComponentStatus.Failed> = ComponentStatus.Created
): FileResponseSuccess => ({
  type,
  fullName,
  filePath,
  state
});

describe('parseRetrieveOnLoad', () => {
  it('should parse single metadata member', () => {
    const result = parseRetrieveOnLoad('ApexClass:Foo');
    expect(result).toEqual([{ type: 'ApexClass', fullName: 'Foo' }]);
  });

  it('should parse multiple metadata members', () => {
    const result = parseRetrieveOnLoad('ApexClass:Foo, CustomTab:MyTab, ApexPage:TestPage');
    expect(result).toEqual([
      { type: 'ApexClass', fullName: 'Foo' },
      { type: 'CustomTab', fullName: 'MyTab' },
      { type: 'ApexPage', fullName: 'TestPage' }
    ]);
  });

  it('should handle extra whitespace', () => {
    const result = parseRetrieveOnLoad('  ApexClass : Foo  ,  CustomTab : MyTab  ');
    expect(result).toEqual([
      { type: 'ApexClass', fullName: 'Foo' },
      { type: 'CustomTab', fullName: 'MyTab' }
    ]);
  });

  it('should filter out invalid entries without colon', () => {
    const result = parseRetrieveOnLoad('ApexClass:Foo, InvalidEntry, CustomTab:MyTab');
    expect(result).toEqual([
      { type: 'ApexClass', fullName: 'Foo' },
      { type: 'CustomTab', fullName: 'MyTab' }
    ]);
  });

  it('should filter out entries with empty parts', () => {
    const result = parseRetrieveOnLoad('ApexClass:Foo, :Empty, EmptyName:, CustomTab:MyTab');
    expect(result).toEqual([
      { type: 'ApexClass', fullName: 'Foo' },
      { type: 'CustomTab', fullName: 'MyTab' }
    ]);
  });

  it('should return empty array for empty string', () => {
    const result = parseRetrieveOnLoad('');
    expect(result).toEqual([]);
  });

  it('should return empty array for whitespace only', () => {
    const result = parseRetrieveOnLoad('   ');
    expect(result).toEqual([]);
  });

  it('should handle trailing commas', () => {
    const result = parseRetrieveOnLoad('ApexClass:Foo, CustomTab:MyTab,');
    expect(result).toEqual([
      { type: 'ApexClass', fullName: 'Foo' },
      { type: 'CustomTab', fullName: 'MyTab' }
    ]);
  });
});

describe('filterFileResponses', () => {
  const workspacePath = '/mock/workspace';
  const workspaceLayer = createMockWorkspaceService(workspacePath);
  const testLayer = Layer.merge(Layer.provide(MetadataRegistryService.Default, workspaceLayer), workspaceLayer);

  it('should include .cls files for ApexClass and not include cls-meta.xml', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls'),
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls-meta.xml')
    ];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual(['/path/to/Foo.cls']);
    expect(result).not.toContain('/path/to/Foo.cls-meta.xml');
  });

  it('should include .tab-meta.xml for CustomTab', async () => {
    const members = [{ type: 'CustomTab', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [createFileResponse('CustomTab', 'Foo', '/path/to/Foo.tab-meta.xml')];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual(['/path/to/Foo.tab-meta.xml']);
  });

  it('should filter out failed file responses', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls', ComponentStatus.Created),
      {
        type: 'ApexClass',
        fullName: 'Bar',
        filePath: '/path/to/Bar.cls',
        state: ComponentStatus.Failed,
        error: 'Failed to retrieve',
        problemType: 'Error' as const
      }
    ];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual(['/path/to/Foo.cls']);
  });

  it('should filter out file responses without filePath', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls'),
      {
        type: 'ApexClass',
        fullName: 'Bar',
        state: ComponentStatus.Created
      } as FileResponse
    ];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual(['/path/to/Foo.cls']);
  });

  it('should normalize Windows backslashes to forward slashes', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [createFileResponse('ApexClass', 'Foo', 'C:\\path\\to\\Foo.cls')];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual(['C:/path/to/Foo.cls']);
  });

  it('should handle multiple metadata types', async () => {
    const members = [
      { type: 'ApexClass', fullName: 'Foo' },
      { type: 'CustomTab', fullName: 'MyTab' },
      { type: 'ApexPage', fullName: 'TestPage' }
    ];
    const fileResponses: FileResponse[] = [
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls'),
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls-meta.xml'),
      createFileResponse('CustomTab', 'MyTab', '/path/to/MyTab.tab-meta.xml'),
      createFileResponse('ApexPage', 'TestPage', '/path/to/TestPage.page'),
      createFileResponse('ApexPage', 'TestPage', '/path/to/TestPage.page-meta.xml')
    ];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual(['/path/to/Foo.cls', '/path/to/MyTab.tab-meta.xml', '/path/to/TestPage.page']);
    expect(result).not.toContain('/path/to/Foo.cls-meta.xml');
    expect(result).not.toContain('/path/to/TestPage.page-meta.xml');
  });

  it('should filter out files that do not match any allowed suffix', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls'),
      createFileResponse('CustomTab', 'SomeTab', '/path/to/SomeTab.tab-meta.xml')
    ];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual(['/path/to/Foo.cls']);
    expect(result).not.toContain('/path/to/SomeTab.tab-meta.xml');
  });

  it('should return empty array when no file responses match', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [createFileResponse('CustomTab', 'MyTab', '/path/to/MyTab.tab-meta.xml')];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual([]);
  });

  it('should handle empty file responses array', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [];

    const result = await Effect.runPromise(filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer)));

    expect(result).toEqual([]);
  });
});
