/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ComponentStatus,
  RegistryAccess,
  type FileResponse,
  type FileResponseFailure,
  type FileResponseSuccess
} from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { parseRetrieveOnLoad, filterFileResponses } from '../../../src/core/retrieveOnLoad';
import { ComponentSetService, type NonEmptyComponentSet } from '../../../src/core/componentSetService';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import { FsService } from '../../../src/vscode/fsService';

/** Create a mock ComponentSetService that only provides the type guards needed for tests */
const createMockComponentSetService = (): Layer.Layer<ComponentSetService, never, never> =>
  Layer.succeed(
    ComponentSetService,
    new ComponentSetService({
      isSDRSuccess: (fileResponse: FileResponse): fileResponse is FileResponseSuccess =>
        fileResponse.state !== ComponentStatus.Failed,
      isSDRFailure: (fileResponse: FileResponse): fileResponse is FileResponseFailure =>
        fileResponse.state === ComponentStatus.Failed,
      ensureNonEmptyComponentSet: () => Effect.succeed({} as NonEmptyComponentSet),
      getComponentSetFromUris: () => Effect.succeed({} as never),
      getComponentSetFromManifest: (_manifestUri: URI) => Effect.succeed({} as never),
      getComponentSetFromProjectDirectories: () => Effect.succeed({} as never)
    })
  );

/** Create a mock MetadataRegistryService with real RegistryAccess (no workspace dependency) */
const createMockMetadataRegistryService = (): Layer.Layer<MetadataRegistryService, never, never> => {
  const registryAccess = new RegistryAccess();
  return Layer.succeed(
    MetadataRegistryService,
    new MetadataRegistryService({
      getRegistry: () => Effect.succeed(registryAccess.getRegistry()),
      getRegistryAccess: () => Effect.succeed(registryAccess)
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
  const testLayer = Layer.mergeAll(createMockComponentSetService(), createMockMetadataRegistryService(), FsService.Default);

  it('should include .cls files for ApexClass and not include cls-meta.xml', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls'),
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls-meta.xml')
    ];

    const { filesToOpen } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toEqual([URI.file('/path/to/Foo.cls')]);
    expect(filesToOpen).not.toContainEqual(URI.file('/path/to/Foo.cls-meta.xml'));
  });

  it('should include .tab-meta.xml for CustomTab', async () => {
    const members = [{ type: 'CustomTab', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [createFileResponse('CustomTab', 'Foo', '/path/to/Foo.tab-meta.xml')];

    const { filesToOpen } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toEqual([URI.file('/path/to/Foo.tab-meta.xml')]);
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

    const { filesToOpen } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toEqual([URI.file('/path/to/Foo.cls')]);
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

    const { filesToOpen } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toEqual([URI.file('/path/to/Foo.cls')]);
  });

  it('should produce a URI for Windows paths', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [createFileResponse('ApexClass', 'Foo', 'C:\\path\\to\\Foo.cls')];

    const { filesToOpen } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toEqual([URI.file('C:\\path\\to\\Foo.cls')]);
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

    const { filesToOpen } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toEqual([
      URI.file('/path/to/Foo.cls'),
      URI.file('/path/to/MyTab.tab-meta.xml'),
      URI.file('/path/to/TestPage.page')
    ]);
    expect(filesToOpen).not.toContainEqual(URI.file('/path/to/Foo.cls-meta.xml'));
    expect(filesToOpen).not.toContainEqual(URI.file('/path/to/TestPage.page-meta.xml'));
  });

  it('should filter out files with unrecognized suffix', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.cls'),
      createFileResponse('ApexClass', 'Foo', '/path/to/Foo.xyz-meta.xml')
    ];

    const { filesToOpen } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toEqual([URI.file('/path/to/Foo.cls')]);
    expect(filesToOpen).not.toContainEqual(URI.file('/path/to/Foo.xyz-meta.xml'));
  });

  it('should return empty arrays when no file responses have recognized suffixes', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [createFileResponse('ApexClass', 'Foo', '/path/to/Foo.xyz-meta.xml')];

    const { filesToOpen, foldersToReveal } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toHaveLength(0);
    expect(foldersToReveal).toHaveLength(0);
  });

  it('should handle empty file responses array', async () => {
    const members = [{ type: 'ApexClass', fullName: 'Foo' }];
    const fileResponses: FileResponse[] = [];

    const { filesToOpen, foldersToReveal } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    expect(filesToOpen).toHaveLength(0);
    expect(foldersToReveal).toHaveLength(0);
  });

  it('should place LWC bundle responses in foldersToReveal as parent folder URIs', async () => {
    const members = [{ type: 'LightningComponentBundle', fullName: 'foo' }];
    const fileResponses: FileResponse[] = [
      createFileResponse('LightningComponentBundle', 'foo', '/path/lwc/foo/foo.js'),
      createFileResponse('LightningComponentBundle', 'foo', '/path/lwc/foo/foo.html'),
      createFileResponse('LightningComponentBundle', 'foo', '/path/lwc/foo/foo.css'),
      createFileResponse('LightningComponentBundle', 'foo', '/path/lwc/foo/foo.js-meta.xml')
    ];

    const { filesToOpen, foldersToReveal } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    const folderUri = URI.file('/path/lwc/foo');
    expect(filesToOpen).toHaveLength(0);
    expect(foldersToReveal).toEqual([folderUri, folderUri, folderUri, folderUri]);
  });

  it('should split mixed members: non-bundle files to open, bundle folders to reveal', async () => {
    const members = [
      { type: 'ApexClass', fullName: 'Bar' },
      { type: 'LightningComponentBundle', fullName: 'foo' }
    ];
    const fileResponses: FileResponse[] = [
      createFileResponse('ApexClass', 'Bar', '/path/classes/Bar.cls'),
      createFileResponse('LightningComponentBundle', 'foo', '/path/lwc/foo/foo.js'),
      createFileResponse('LightningComponentBundle', 'foo', '/path/lwc/foo/foo.html')
    ];

    const { filesToOpen, foldersToReveal } = await Effect.runPromise(
      filterFileResponses(fileResponses, members).pipe(Effect.provide(testLayer))
    );

    const folderUri = URI.file('/path/lwc/foo');
    expect(filesToOpen).toEqual([URI.file('/path/classes/Bar.cls')]);
    expect(foldersToReveal).toEqual([folderUri, folderUri]);
  });
});
