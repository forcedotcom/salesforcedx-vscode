/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';
import { toUri } from 'salesforcedx-vscode-services/src/vscode/uriUtils';
import { URI } from 'vscode-uri';
import type { DiffFilePair } from '../../../../src/shared/diff/diffTypes';
import {
  filesAreNotIdentical,
  matchUrisToComponents,
  sourceComponentToPaths
} from '../../../../src/shared/diff/diffHelpers';

const createMockComponent = (
  fullName = 'ConflictsTest',
  typeName = 'ApexClass',
  content?: string,
  xml?: string,
  walkContentPaths: string[] = []
): SourceComponent =>
  ({
    fullName,
    type: { name: typeName },
    content,
    xml,
    walkContent: () => walkContentPaths
  }) as unknown as SourceComponent;

const createMockProjectSet = (components: SourceComponent[]): ComponentSet =>
  ({
    getSourceComponents: () => ({ toArray: () => components })
  }) as unknown as ComponentSet;

const createMockRetrievedSet = (remoteComponents: SourceComponent[]): ComponentSet =>
  ({
    getComponentFilenamesByNameAndType: ({ fullName, type }: { fullName: string; type: string }) =>
      remoteComponents
        .filter(c => c.fullName === fullName && c.type.name === type)
        .flatMap(c => sourceComponentToPaths(c))
  }) as unknown as ComponentSet;

/** api.services.FsService is an Effect that yields the service */
const createMockFsService = (overrides?: { readFile?: (path: string | URI) => Effect.Effect<string> }) => {
  const base = {
    toUri: (path: string | URI) => Effect.succeed(toUri(path)),
    HashableUri
  };
  return overrides ? { ...base, ...overrides } : base;
};

const createMockExtensionProvider = () => ({
  getServicesApi: Effect.succeed({
    services: { FsService }
  })
}) as unknown as ExtensionProviderService;

const provideMocks = (fsService = createMockFsService()) => (e: Effect.Effect<unknown, unknown, unknown>) =>
  e.pipe(
    Effect.provideService(ExtensionProviderService, createMockExtensionProvider()),
    Effect.provideService(FsService, fsService as InstanceType<typeof FsService>)
  );

/** Run effect with mocks - cast to satisfy runPromise's never requirement */
const runWithMocks = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  fsService = createMockFsService()
) => Effect.runPromise(effect.pipe(provideMocks(fsService)) as Effect.Effect<A, E, never>);

describe('matchUrisToComponents', () => {
  it('returns pairs when local .cls matches remote .cls path', async () => {
    const localPath = '/workspace/force-app/main/default/classes/ConflictsTest.cls';
    const remoteCls =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls';
    const remoteMeta =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls-meta.xml';

    const localUriFilter = HashSet.fromIterable([HashableUri.file(localPath)]);
    const projectSet = createMockProjectSet([createMockComponent('ConflictsTest', 'ApexClass', localPath)]);
    const retrievedSet = createMockRetrievedSet([
      createMockComponent('ConflictsTest', 'ApexClass', remoteCls, remoteMeta)
    ]);

    const result = (await runWithMocks(
      matchUrisToComponents(projectSet, retrievedSet, localUriFilter)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(1);
    const [pair] = [...HashSet.toValues(result)];
    expect(pair.fileName).toBe('ConflictsTest.cls');
    expect(pair.localUri.path).toContain('ConflictsTest.cls');
    expect(pair.remoteUri.path).toContain('ConflictsTest.cls');
  });

  it('returns empty when no remote component matches fullName', async () => {
    const localPath = '/workspace/force-app/main/default/classes/ConflictsTest.cls';
    const remoteCls =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/OtherClass.cls';

    const localUriFilter = HashSet.fromIterable([HashableUri.file(localPath)]);
    const projectSet = createMockProjectSet([createMockComponent('ConflictsTest', 'ApexClass', localPath)]);
    const retrievedSet = createMockRetrievedSet([createMockComponent('OtherClass', 'ApexClass', remoteCls)]);

    const result = (await runWithMocks(
      matchUrisToComponents(projectSet, retrievedSet, localUriFilter)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(0);
  });

  it('matches .cls not .cls-meta.xml when local file is ConflictsTest.cls', async () => {
    const localPath = '/workspace/force-app/main/default/classes/ConflictsTest.cls';
    const remoteCls =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls';
    const remoteMeta =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls-meta.xml';

    const localUriFilter = HashSet.fromIterable([HashableUri.file(localPath)]);
    // project component has only the .cls (no -meta.xml) so only .cls is iterated locally
    const projectSet = createMockProjectSet([createMockComponent('ConflictsTest', 'ApexClass', localPath)]);
    const retrievedSet = createMockRetrievedSet([
      createMockComponent('ConflictsTest', 'ApexClass', remoteCls, remoteMeta)
    ]);

    const result = (await runWithMocks(
      matchUrisToComponents(projectSet, retrievedSet, localUriFilter)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(1);
    const [pair] = [...HashSet.toValues(result)];
    expect(pair.remoteUri.path).toBe(remoteCls);
    expect(pair.remoteUri.path.endsWith('.cls-meta.xml')).toBe(false);
  });

  it('returns empty when localUriFilter filters out all local files', async () => {
    const localPath = '/workspace/force-app/main/default/classes/ConflictsTest.cls';
    const remoteCls =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls';

    const projectSet = createMockProjectSet([createMockComponent('ConflictsTest', 'ApexClass', localPath)]);
    const retrievedSet = createMockRetrievedSet([createMockComponent('ConflictsTest', 'ApexClass', remoteCls)]);

    const result = (await runWithMocks(
      matchUrisToComponents(projectSet, retrievedSet, HashSet.empty())
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(0);
  });

  it('returns empty for empty projectComponents', async () => {
    const result = (await runWithMocks(
      matchUrisToComponents(createMockProjectSet([]), createMockRetrievedSet([]))
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(0);
  });

  it('matches when localUriFilter has lowercase drive letter but component path has uppercase (Windows)', async () => {
    // On Windows, VSCode provides URIs with lowercase drive letters (/c:/...)
    // while SDR returns file-system paths that URI.file() converts to uppercase (/C:/...).
    // toUri() normalizes /C:/ → /c:/ so HashSet.has() finds the match.
    // We use /C:/ and /c:/ paths directly to test this behavior cross-platform.
    const vscodePath = '/c:/Users/runner/project/classes/ConflictsTest.cls';
    const sdrPath = '/C:/Users/runner/project/classes/ConflictsTest.cls';
    const remoteCls = '/C:/Users/runner/.sf/orgs/org123/remoteMetadata/classes/ConflictsTest.cls';

    const localUriFilter = HashSet.fromIterable([HashableUri.fromUri(toUri(vscodePath))]);
    const projectSet = createMockProjectSet([createMockComponent('ConflictsTest', 'ApexClass', sdrPath)]);
    const retrievedSet = createMockRetrievedSet([createMockComponent('ConflictsTest', 'ApexClass', remoteCls)]);

    const result = (await runWithMocks(
      matchUrisToComponents(projectSet, retrievedSet, localUriFilter)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(1);
  });

  it('matches Apex class in non-default directory (controllers, not classes)', async () => {
    const localPath = '/workspace/force-app/main/default/controllers/MyClass.cls';
    const remoteCls = '/workspace/.sf/orgs/org123/remoteMetadata/classes/MyClass.cls';

    const localUriFilter = HashSet.fromIterable([HashableUri.file(localPath)]);
    const projectSet = createMockProjectSet([createMockComponent('MyClass', 'ApexClass', localPath)]);
    const retrievedSet = createMockRetrievedSet([createMockComponent('MyClass', 'ApexClass', remoteCls)]);

    const result = (await runWithMocks(
      matchUrisToComponents(projectSet, retrievedSet, localUriFilter)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(1);
    const [pair] = [...HashSet.toValues(result)];
    expect(pair.localUri.path).toContain('controllers/MyClass.cls');
    expect(pair.remoteUri.path).toContain('classes/MyClass.cls');
  });
});

describe('filesAreNotIdentical', () => {
  it('returns true when local and remote content differ', async () => {
    const localPath = '/workspace/classes/Test.cls';
    const remotePath = '/remote/classes/Test.cls';
    const pair = {
      localUri: HashableUri.file(localPath),
      remoteUri: HashableUri.file(remotePath),
      fileName: 'Test.cls'
    };

    const mockFsService = {
      ...createMockFsService(),
      readFile: (path: string | URI) =>
        Effect.succeed(
          path.toString().includes('remote') ? 'remote content' : 'local content'
        )
    };

    const result = await runWithMocks(filesAreNotIdentical(pair), mockFsService);

    expect(result).toBe(true);
  });

  it('returns false when local and remote content are identical', async () => {
    const localPath = '/workspace/classes/Test.cls';
    const remotePath = '/remote/classes/Test.cls';
    const pair = {
      localUri: HashableUri.file(localPath),
      remoteUri: HashableUri.file(remotePath),
      fileName: 'Test.cls'
    };

    const mockFsService = {
      ...createMockFsService(),
      readFile: () => Effect.succeed('same content')
    };

    const result = await runWithMocks(filesAreNotIdentical(pair), mockFsService);

    expect(result).toBe(false);
  });
});
