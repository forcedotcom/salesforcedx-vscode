/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';
import { URI } from 'vscode-uri';
import type { DiffFilePair } from '../../../../src/shared/diff/diffTypes';
import { filesAreNotIdentical, matchUrisToComponents } from '../../../../src/shared/diff/diffHelpers';

/** Mock SourceComponent-like object - diffHelpers uses content, xml, walkContent() */
const createMockComponent = (
  content?: string,
  xml?: string,
  walkContentPaths: string[] = []
): SourceComponent =>
  ({
    content,
    xml,
    walkContent: () => walkContentPaths
  }) as unknown as SourceComponent;

/** api.services.FsService is an Effect that yields the service */
const createMockFsService = (overrides?: { readFile?: (path: string | URI) => Effect.Effect<string> }) => {
  const base = {
    toUri: (path: string | URI) =>
      Effect.succeed(typeof path === 'string' ? URI.file(path) : path),
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
    const localPath =
      '/workspace/force-app/main/default/classes/ConflictsTest.cls';
    const remoteCls =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls';
    const remoteMeta =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls-meta.xml';

    const initialUris = HashSet.fromIterable([HashableUri.file(localPath)]);
    const components = [
      createMockComponent(remoteCls, remoteMeta, [remoteCls, remoteMeta])
    ];

    const result = (await runWithMocks(
      matchUrisToComponents(initialUris, components)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(1);
    const [pair] = [...HashSet.toValues(result)];
    expect(pair.fileName).toBe('ConflictsTest.cls');
    expect(pair.localUri.path).toContain('ConflictsTest.cls');
    expect(pair.remoteUri.path).toContain('ConflictsTest.cls');
  });

  it('returns empty when remote path does not end with fileName', async () => {
    const localPath =
      '/workspace/force-app/main/default/classes/ConflictsTest.cls';
    const remoteCls =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/OtherClass.cls';

    const initialUris = HashSet.fromIterable([HashableUri.file(localPath)]);
    const components = [createMockComponent(remoteCls, undefined, [remoteCls])];

    const result = (await runWithMocks(
      matchUrisToComponents(initialUris, components)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(0);
  });

  it('matches .cls not .cls-meta.xml when fileName is ConflictsTest.cls', async () => {
    const localPath =
      '/workspace/force-app/main/default/classes/ConflictsTest.cls';
    const remoteCls =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls';
    const remoteMeta =
      '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls-meta.xml';

    const initialUris = HashSet.fromIterable([HashableUri.file(localPath)]);
    const components = [
      createMockComponent(remoteCls, remoteMeta, [remoteCls, remoteMeta])
    ];

    const result = (await runWithMocks(
      matchUrisToComponents(initialUris, components)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(1);
    const [pair] = [...HashSet.toValues(result)];
    expect(pair.remoteUri.path).toBe(remoteCls);
    expect(pair.remoteUri.path.endsWith('.cls-meta.xml')).toBe(false);
  });

  it('returns empty for empty initialUris', async () => {
    const components = [
      createMockComponent(
        '/remote/ConflictsTest.cls',
        undefined,
        ['/remote/ConflictsTest.cls']
      )
    ];

    const result = (await runWithMocks(
      matchUrisToComponents(HashSet.empty(), components)
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(0);
  });

  it('returns empty for empty retrievedComponents', async () => {
    const initialUris = HashSet.fromIterable([
      HashableUri.file('/workspace/classes/ConflictsTest.cls')
    ]);

    const result = (await runWithMocks(
      matchUrisToComponents(initialUris, [])
    )) as HashSet.HashSet<DiffFilePair>;

    expect(HashSet.size(result)).toBe(0);
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
