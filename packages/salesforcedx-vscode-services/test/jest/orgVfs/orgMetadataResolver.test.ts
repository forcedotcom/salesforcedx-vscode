/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ComponentSetService } from '../../../src/core/componentSetService';
import { ConnectionService } from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { MetadataDescribeService } from '../../../src/core/metadataDescribeService';
import { MetadataRetrieveService } from '../../../src/core/metadataRetrieveService';
import { ProjectService } from '../../../src/core/projectService';
import { mergePresence, OrgMetadataResolver, orgMetadataUri } from '../../../src/orgVfs/orgMetadataResolver';
import { ChannelService } from '../../../src/vscode/channelService';
import { FsService } from '../../../src/vscode/fsService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

type DescribeService = Context.Tag.Service<typeof MetadataDescribeService>;
type RetrieveService = Context.Tag.Service<typeof MetadataRetrieveService>;
type Project = Context.Tag.Service<typeof ProjectService>;
type ComponentSets = Context.Tag.Service<typeof ComponentSetService>;
type Connections = Context.Tag.Service<typeof ConnectionService>;
type FileSystem = Context.Tag.Service<typeof FsService>;
type Workspace = Context.Tag.Service<typeof WorkspaceService>;

const apexType = { name: 'ApexClass' };
const sourceComponent = (fullName: string, content: string) => ({
  fullName,
  name: fullName,
  content,
  type: apexType
});

const makeResolverLayer = ({
  orgNames,
  workspaceComponents,
  listMetadata = jest.fn(),
  toolingQuery = jest.fn(),
  retrieveToDirectory = jest.fn(() => Effect.die('not implemented in this test')),
  safeDelete = jest.fn(() => Effect.void),
  retrieve = jest.fn(() => Effect.succeed({}))
}: {
  orgNames: string[];
  workspaceComponents: ReturnType<typeof sourceComponent>[];
  listMetadata?: jest.Mock;
  toolingQuery?: jest.Mock;
  retrieveToDirectory?: jest.Mock;
  safeDelete?: jest.Mock;
  retrieve?: jest.Mock;
}) => {
  if (!listMetadata.getMockImplementation()) {
    listMetadata.mockImplementation(() => Effect.succeed(orgNames.map(fullName => ({ fullName, type: 'ApexClass' }))));
  }
  const describeService = {
    describe: () => Effect.succeed([{ xmlName: 'ApexClass' }]),
    listMetadata
  } as unknown as DescribeService;
  const retrieveService = {
    buildComponentSet: () => Effect.succeed({ size: 1 }),
    buildComponentSetFromSource: () =>
      Effect.succeed({
        getSourceComponents: () => workspaceComponents
      }),
    retrieve,
    retrieveComponentSetToDirectory: retrieveToDirectory
  } as unknown as RetrieveService;
  const projectService = {
    getSfProject: () =>
      Effect.succeed({
        getPackageDirectories: () => [{ fullPath: '/workspace/force-app' }]
      })
  } as unknown as Project;
  const componentSetService = {
    ensureNonEmptyComponentSet: (componentSet: unknown) => Effect.succeed(componentSet)
  } as unknown as ComponentSets;
  const connectionService = {
    getConnection: () =>
      Effect.succeed({
        tooling: { query: toolingQuery }
      })
  } as unknown as Connections;
  const fsService = {
    safeDelete
  } as unknown as FileSystem;
  const workspaceService = {
    getWorkspaceInfoOrThrow: () =>
      Effect.succeed({
        uri: URI.file('/workspace'),
        path: 'file:///workspace',
        fsPath: '/workspace',
        isEmpty: false,
        isVirtualFs: false,
        cwd: '/workspace'
      })
  } as unknown as Workspace;

  const dependencies = Layer.mergeAll(
    Layer.succeed(ComponentSetService, componentSetService),
    Layer.succeed(ConnectionService, connectionService),
    Layer.succeed(FsService, fsService),
    Layer.succeed(MetadataDescribeService, describeService),
    Layer.succeed(MetadataRetrieveService, retrieveService),
    Layer.succeed(ProjectService, projectService),
    Layer.succeed(WorkspaceService, workspaceService)
  );
  return Layer.merge(
    Layer.provide(OrgMetadataResolver.DefaultWithoutDependencies, dependencies),
    ChannelService.Default
  );
};

const seedOrg = Effect.gen(function* () {
  yield* SubscriptionRef.set(yield* getDefaultOrgRef(), { orgId: '00DTEST' });
});

describe('OrgMetadataResolver', () => {
  it('merges org and workspace presence across all four states', () => {
    const localUri = URI.file('/workspace/Local.cls');
    const bothUri = URI.file('/workspace/Both.cls');
    const result = mergePresence({
      orgNames: ['Both', 'OrgOnly'],
      workspaceUris: new Map([
        ['Both', bothUri],
        ['LocalOnly', localUri]
      ])
    });

    expect(result.get('OrgOnly')).toEqual({ inOrg: true, inWorkspace: false });
    expect(result.get('Both')).toEqual({ inOrg: true, inWorkspace: true, workspaceUri: bothUri });
    expect(result.get('LocalOnly')).toEqual({ inOrg: false, inWorkspace: true, workspaceUri: localUri });
    expect(result.get('Neither')).toBeUndefined();
  });

  it('serves union directory entries and resolves workspace files', async () => {
    const localPath = '/workspace/force-app/main/default/classes/LocalOnly.cls';
    const layer = makeResolverLayer({
      orgNames: ['Both', 'OrgOnly'],
      workspaceComponents: [
        sourceComponent('Both', '/workspace/force-app/a/needlessly/long/classes/Both.cls'),
        sourceComponent('Both', '/workspace/Both.cls'),
        sourceComponent('LocalOnly', localPath)
      ]
    });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrg;
        const resolver = yield* OrgMetadataResolver;
        const typeUri = orgMetadataUri({ orgKey: '00DTEST', xmlName: 'ApexClass', fullName: '' });
        const localUri = orgMetadataUri({ orgKey: '00DTEST', xmlName: 'ApexClass', fullName: 'LocalOnly' });
        const bothUri = orgMetadataUri({ orgKey: '00DTEST', xmlName: 'ApexClass', fullName: 'Both' });
        return {
          entries: yield* resolver.readDirectory(typeUri),
          presence: yield* resolver.getPresence(localUri),
          openUri: yield* resolver.getUriForFile(localUri),
          bothPresence: yield* resolver.getPresence(bothUri)
        };
      }).pipe(Effect.provide(layer))
    );

    expect(result.entries).toEqual([
      ['Both', vscode.FileType.File],
      ['LocalOnly', vscode.FileType.File],
      ['OrgOnly', vscode.FileType.File]
    ]);
    expect(result.presence).toEqual({
      inOrg: false,
      inWorkspace: true,
      workspaceUri: URI.file(localPath)
    });
    expect(result.openUri).toEqual(URI.file(localPath));
    expect(result.bothPresence.workspaceUri).toEqual(URI.file('/workspace/Both.cls'));
  });

  it('recomputes a type after invalidation', async () => {
    const listMetadata = jest.fn();
    const layer = makeResolverLayer({ orgNames: ['First'], workspaceComponents: [], listMetadata });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrg;
        const resolver = yield* OrgMetadataResolver;
        const firstUri = orgMetadataUri({ orgKey: '00DTEST', xmlName: 'ApexClass', fullName: 'First' });
        expect((yield* resolver.getPresence(firstUri)).inOrg).toBe(true);
        expect((yield* resolver.getPresence(firstUri)).inOrg).toBe(true);
        yield* resolver.invalidate();
        expect((yield* resolver.getPresence(firstUri)).inOrg).toBe(true);
      }).pipe(Effect.provide(layer))
    );

    expect(listMetadata).toHaveBeenCalledTimes(2);
  });

  it('reads workspace content directly when the component is local', async () => {
    const workspaceContent = new TextEncoder().encode('local source');
    const readFile = jest.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(workspaceContent);
    const layer = makeResolverLayer({
      orgNames: ['Both'],
      workspaceComponents: [sourceComponent('Both', '/workspace/Both.cls')]
    });

    const content = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrg;
        return yield* OrgMetadataResolver.readFile(
          orgMetadataUri({ orgKey: '00DTEST', xmlName: 'ApexClass', fullName: 'Both' })
        );
      }).pipe(Effect.provide(layer))
    );

    expect(content).toEqual(workspaceContent);
    expect(readFile).toHaveBeenCalledWith(URI.file('/workspace/Both.cls'));
    readFile.mockRestore();
  });

  it('fetches an org-only Apex class lazily and holds the bytes until invalidated', async () => {
    const toolingQuery = jest.fn().mockResolvedValue({
      records: [{ Name: 'OrgOnly', Body: 'public class OrgOnly {}', NamespacePrefix: null }]
    });
    const layer = makeResolverLayer({ orgNames: ['OrgOnly'], workspaceComponents: [], toolingQuery });
    const uri = orgMetadataUri({ orgKey: '00DTEST', xmlName: 'ApexClass', fullName: 'OrgOnly' });

    const contents = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrg;
        const resolver = yield* OrgMetadataResolver;
        const first = yield* resolver.readFile(uri);
        const second = yield* resolver.readFile(uri);
        yield* resolver.invalidate();
        const afterInvalidation = yield* resolver.readFile(uri);
        return [first, second, afterInvalidation];
      }).pipe(Effect.provide(layer))
    );

    expect(contents.map(content => new TextDecoder().decode(content))).toEqual([
      'public class OrgOnly {}',
      'public class OrgOnly {}',
      'public class OrgOnly {}'
    ]);
    expect(toolingQuery).toHaveBeenCalledTimes(2);
  });

  it('retrieves generic org-only metadata transiently and removes the retrieve directory', async () => {
    const remoteContent = new TextEncoder().encode('<CustomTab/>');
    const sourcePath = '/workspace/.sf/orgs/00dtest/org-metadata-read/CustomTab/Thing/Thing.tab-meta.xml';
    const readFile = jest.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(remoteContent);
    const safeDelete = jest.fn(() => Effect.void);
    const retrieveToDirectory = jest.fn(() =>
      Effect.succeed({
        components: {
          getSourceComponents: () => [{ type: { name: 'CustomTab' }, fullName: 'Thing', content: sourcePath }],
          getComponentFilenamesByNameAndType: () => [sourcePath]
        }
      })
    );
    const layer = makeResolverLayer({
      orgNames: ['Thing'],
      workspaceComponents: [],
      retrieveToDirectory,
      safeDelete
    });

    const content = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrg;
        return yield* OrgMetadataResolver.readFile(
          orgMetadataUri({ orgKey: '00DTEST', xmlName: 'CustomTab', fullName: 'Thing' })
        );
      }).pipe(Effect.provide(layer))
    );

    expect(content).toEqual(remoteContent);
    expect(retrieveToDirectory).toHaveBeenCalledTimes(1);
    expect(safeDelete).toHaveBeenCalledTimes(2);
    expect(readFile).toHaveBeenCalledWith(URI.file(sourcePath));
    readFile.mockRestore();
  });

  it('downloads an org-only component and resolves its new workspace URI', async () => {
    const workspaceComponents: ReturnType<typeof sourceComponent>[] = [];
    const retrieve = jest.fn(() =>
      Effect.sync(() => {
        workspaceComponents.push(sourceComponent('OrgOnly', '/workspace/OrgOnly.cls'));
      })
    );
    const layer = makeResolverLayer({
      orgNames: ['OrgOnly'],
      workspaceComponents,
      retrieve
    });
    const canonicalUri = orgMetadataUri({
      orgKey: '00DTEST',
      xmlName: 'ApexClass',
      fullName: 'OrgOnly'
    });

    const workspaceUri = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrg;
        return yield* OrgMetadataResolver.download(canonicalUri);
      }).pipe(Effect.provide(layer))
    );

    expect(retrieve).toHaveBeenCalledWith([{ type: 'ApexClass', fullName: 'OrgOnly' }], { ignoreConflicts: true });
    expect(workspaceUri).toEqual(URI.file('/workspace/OrgOnly.cls'));
  });

  it('builds foldered metadata directories from folder-scoped org listings', async () => {
    const listMetadata = jest.fn((type: string, folder?: string) => {
      if (type === 'ReportFolder') {
        return Effect.succeed([
          { fullName: 'empty', type },
          { fullName: 'unfiled$public', type }
        ]);
      }
      if (type === 'Report' && folder === 'unfiled$public') {
        return Effect.succeed([{ fullName: 'unfiled$public/Sales', type }]);
      }
      return Effect.succeed([]);
    });
    const layer = makeResolverLayer({ orgNames: [], workspaceComponents: [], listMetadata });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedOrg;
        const resolver = yield* OrgMetadataResolver;
        const typeUri = orgMetadataUri({ orgKey: '00DTEST', xmlName: 'Report', fullName: '' });
        const folderUri = orgMetadataUri({
          orgKey: '00DTEST',
          xmlName: 'Report',
          fullName: 'unfiled$public'
        });
        return {
          folders: yield* resolver.readDirectory(typeUri),
          reports: yield* resolver.readDirectory(folderUri)
        };
      }).pipe(Effect.provide(layer))
    );

    expect(result.folders).toEqual([
      ['empty', vscode.FileType.Directory],
      ['unfiled$public', vscode.FileType.Directory]
    ]);
    expect(result.reports).toEqual([['Sales', vscode.FileType.File]]);
    expect(listMetadata).toHaveBeenCalledWith('Report', 'unfiled$public');
  });
});
