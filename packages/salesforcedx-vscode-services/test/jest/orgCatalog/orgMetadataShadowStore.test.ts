/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import {
  ORG_METADATA_SHADOW_REVISIONS_TO_KEEP,
  OrgMetadataShadowStore,
  isOrgMetadataShadowUri
} from '../../../src/orgCatalog/orgMetadataShadowStore';
import { FsService } from '../../../src/vscode/fsService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

const workspaceUri = URI.file('/workspace');

const makeFsService = () => {
  const files = new Map<string, string>();
  const failedDeletes = new Set<string>();
  const service = new FsService({
    createDirectory: () => Effect.void,
    safeDelete: (uri: URI) =>
      failedDeletes.has(uri.toString())
        ? Effect.fail(new Error(`failed to delete ${uri.toString()}`))
        : Effect.sync(() => {
            const prefix = uri.toString();
            [...files.keys()]
              .filter(key => key === prefix || key.startsWith(`${prefix}/`))
              .forEach(key => files.delete(key));
          }),
    safeWriteFile: (uri: URI, content: string) =>
      Effect.sync(() => {
        files.set(uri.toString(), content);
      }),
    rename: (from: string, to: string) =>
      Effect.sync(() => {
        [...files].forEach(([key, value]) => {
          if (!key.startsWith(from)) return;
          files.delete(key);
          files.set(`${to}${key.slice(from.length)}`, value);
        });
      }),
    readJSON: (path: string) => {
      const value = files.get(path);
      return value === undefined ? Effect.fail(new Error('not found')) : Effect.sync(() => JSON.parse(value));
    },
    readDirectory: (uri: URI) =>
      Effect.sync(() => {
        const prefix = `${uri.path}/`;
        return [
          ...new Map(
            [...files.keys()].flatMap(key => {
              const child = URI.parse(key);
              if (child.scheme !== uri.scheme || !child.path.startsWith(prefix)) return [];
              const name = child.path.slice(prefix.length).split('/')[0];
              return name ? [[name, Utils.joinPath(uri, name)] as const] : [];
            })
          ).values()
        ];
      }),
    fileOrFolderExists: (uri: URI) => Effect.succeed(files.has(uri.toString()))
  } as unknown as FsService);
  return { failedDeletes, files, service };
};

const workspaceService = new WorkspaceService({
  getWorkspaceInfoOrThrow: () =>
    Effect.succeed({
      uri: workspaceUri,
      path: workspaceUri.toString(),
      fsPath: workspaceUri.fsPath,
      isEmpty: false,
      isVirtualFs: false,
      cwd: workspaceUri.fsPath
    })
} as unknown as WorkspaceService);

describe('OrgMetadataShadowStore', () => {
  const publishRevision = (
    store: InstanceType<typeof OrgMetadataShadowStore>,
    files: Map<string, string>,
    orgId: string,
    reference: { readonly xmlName: string; readonly fullName: string },
    revision: string
  ) =>
    Effect.gen(function* () {
      const preparation = yield* store.prepare(orgId, reference, revision);
      const primaryUri = Utils.joinPath(preparation.stagingUri, `${reference.fullName}.cls`);
      files.set(primaryUri.toString(), revision);
      return yield* store.publish({
        orgId,
        reference,
        stagingUri: preparation.stagingUri,
        primaryUri,
        fileUris: [primaryUri],
        remoteLastModifiedDate: revision
      });
    });

  it('stages SDR conversion under remoteMetadata and publishes under metadata-shadow', async () => {
    const { service } = makeFsService();
    const preparation = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* OrgMetadataShadowStore).prepare(
          '00D',
          { xmlName: 'ApexClass', fullName: 'FooTest' },
          'revision-1'
        );
      }).pipe(
        Effect.provide(OrgMetadataShadowStore.DefaultWithoutDependencies),
        Effect.provideService(FsService, service),
        Effect.provideService(WorkspaceService, workspaceService)
      )
    );

    expect(preparation.stagingUri.path).toContain(
      '/.sf/orgs/00D/remoteMetadata/catalog-staging/ApexClass/FooTest/revision-1.__staging__'
    );
    expect(preparation.rootUri.path).toContain('/.sf/orgs/00D/metadata-shadow/ApexClass/FooTest/revisions/revision-1');
  });

  it('prepares a shared SDR staging directory for batch materialization', async () => {
    const { service } = makeFsService();
    const stagingUri = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* OrgMetadataShadowStore).prepareBatch('00D');
      }).pipe(
        Effect.provide(OrgMetadataShadowStore.DefaultWithoutDependencies),
        Effect.provideService(FsService, service),
        Effect.provideService(WorkspaceService, workspaceService)
      )
    );

    expect(stagingUri.path).toContain('/.sf/orgs/00D/remoteMetadata/catalog-staging/batch.__staging__');
  });

  it('keeps revision snapshots independently addressable', async () => {
    const { files, service } = makeFsService();
    const reference = { xmlName: 'ApexClass', fullName: 'FooTest' };
    const program = Effect.gen(function* () {
      const store = yield* OrgMetadataShadowStore;

      const firstPreparation = yield* store.prepare('00D', reference, 'revision-1');
      const firstPrimary = Utils.joinPath(firstPreparation.stagingUri, 'FooTest.cls');
      files.set(firstPrimary.toString(), 'revision one');
      yield* store.publish({
        orgId: '00D',
        reference,
        stagingUri: firstPreparation.stagingUri,
        primaryUri: firstPrimary,
        fileUris: [firstPrimary],
        remoteLastModifiedDate: 'revision-1'
      });

      const secondPreparation = yield* store.prepare('00D', reference, 'revision-2');
      const secondPrimary = Utils.joinPath(secondPreparation.stagingUri, 'FooTest.cls');
      files.set(secondPrimary.toString(), 'revision two');
      yield* store.publish({
        orgId: '00D',
        reference,
        stagingUri: secondPreparation.stagingUri,
        primaryUri: secondPrimary,
        fileUris: [secondPrimary],
        remoteLastModifiedDate: 'revision-2'
      });

      return yield* Effect.all([
        store.get('00D', reference, 'revision-1'),
        store.get('00D', reference, 'revision-2'),
        store.get('00D', reference, 'revision-3')
      ]);
    }).pipe(
      Effect.provide(OrgMetadataShadowStore.DefaultWithoutDependencies),
      Effect.provideService(FsService, service),
      Effect.provideService(WorkspaceService, workspaceService)
    );

    const [first, second, missing] = await Effect.runPromise(program);
    expect(first?.primaryUri.toString()).not.toBe(second?.primaryUri.toString());
    expect(first?.remoteLastModifiedDate).toBe('revision-1');
    expect(second?.remoteLastModifiedDate).toBe('revision-2');
    expect(missing).toBeUndefined();
  });

  it('partitions identical component revisions by org', async () => {
    const { files, service } = makeFsService();
    const reference = { xmlName: 'ApexClass', fullName: 'FooTest' };
    const program = Effect.gen(function* () {
      const store = yield* OrgMetadataShadowStore;
      const firstPreparation = yield* store.prepare('org-one', reference, 'revision-1');
      const firstPrimary = Utils.joinPath(firstPreparation.stagingUri, 'FooTest.cls');
      files.set(firstPrimary.toString(), 'org one');
      yield* store.publish({
        orgId: 'org-one',
        reference,
        stagingUri: firstPreparation.stagingUri,
        primaryUri: firstPrimary,
        fileUris: [firstPrimary],
        remoteLastModifiedDate: 'revision-1'
      });

      const secondPreparation = yield* store.prepare('org-two', reference, 'revision-1');
      const secondPrimary = Utils.joinPath(secondPreparation.stagingUri, 'FooTest.cls');
      files.set(secondPrimary.toString(), 'org two');
      yield* store.publish({
        orgId: 'org-two',
        reference,
        stagingUri: secondPreparation.stagingUri,
        primaryUri: secondPrimary,
        fileUris: [secondPrimary],
        remoteLastModifiedDate: 'revision-1'
      });

      return yield* Effect.all([
        store.get('org-one', reference, 'revision-1'),
        store.get('org-two', reference, 'revision-1')
      ]);
    }).pipe(
      Effect.provide(OrgMetadataShadowStore.DefaultWithoutDependencies),
      Effect.provideService(FsService, service),
      Effect.provideService(WorkspaceService, workspaceService)
    );

    const [orgOne, orgTwo] = await Effect.runPromise(program);
    expect(orgOne?.primaryUri.toString()).not.toBe(orgTwo?.primaryUri.toString());
    expect(files.get(orgOne?.primaryUri.toString() ?? '')).toBe('org one');
    expect(files.get(orgTwo?.primaryUri.toString() ?? '')).toBe('org two');
  });

  it('retains only the newest bounded revisions for a component', async () => {
    const { files, service } = makeFsService();
    const reference = { xmlName: 'ApexClass', fullName: 'FooTest' };
    const revisions = Array.from(
      { length: ORG_METADATA_SHADOW_REVISIONS_TO_KEEP + 1 },
      (_, index) => `revision-${index + 1}`
    );
    const program = Effect.gen(function* () {
      const store = yield* OrgMetadataShadowStore;
      yield* Effect.forEach(revisions, revision => publishRevision(store, files, '00D', reference, revision), {
        concurrency: 1
      });
      return yield* Effect.forEach(revisions, revision => store.get('00D', reference, revision), { concurrency: 1 });
    }).pipe(
      Effect.provide(OrgMetadataShadowStore.DefaultWithoutDependencies),
      Effect.provideService(FsService, service),
      Effect.provideService(WorkspaceService, workspaceService)
    );

    const artifacts = await Effect.runPromise(program);
    expect(artifacts[0]).toBeUndefined();
    expect(artifacts.slice(1).every(artifact => artifact !== undefined)).toBe(true);
  });

  it('preserves an older revision that backs an open editor document', async () => {
    const { files, service } = makeFsService();
    const reference = { xmlName: 'ApexClass', fullName: 'FooTest' };
    const textDocuments = vscode.workspace.textDocuments as vscode.TextDocument[];
    const program = Effect.gen(function* () {
      const store = yield* OrgMetadataShadowStore;
      const first = yield* publishRevision(store, files, '00D', reference, 'revision-1');
      if (first) textDocuments.push({ uri: first.primaryUri } as vscode.TextDocument);
      yield* Effect.forEach(
        ['revision-2', 'revision-3', 'revision-4'],
        revision => publishRevision(store, files, '00D', reference, revision),
        { concurrency: 1 }
      );
      return yield* store.get('00D', reference, 'revision-1');
    }).pipe(
      Effect.ensuring(Effect.sync(() => textDocuments.splice(0, textDocuments.length))),
      Effect.provide(OrgMetadataShadowStore.DefaultWithoutDependencies),
      Effect.provideService(FsService, service),
      Effect.provideService(WorkspaceService, workspaceService)
    );

    await expect(Effect.runPromise(program)).resolves.toBeDefined();
  });

  it('does not fail publication when pruning an old revision fails', async () => {
    const { failedDeletes, files, service } = makeFsService();
    const reference = { xmlName: 'ApexClass', fullName: 'FooTest' };
    const program = Effect.gen(function* () {
      const store = yield* OrgMetadataShadowStore;
      const first = yield* publishRevision(store, files, '00D', reference, 'revision-1');
      if (first) failedDeletes.add(first.rootUri.toString());
      yield* publishRevision(store, files, '00D', reference, 'revision-2');
      yield* publishRevision(store, files, '00D', reference, 'revision-3');
      return yield* publishRevision(store, files, '00D', reference, 'revision-4');
    }).pipe(
      Effect.provide(OrgMetadataShadowStore.DefaultWithoutDependencies),
      Effect.provideService(FsService, service),
      Effect.provideService(WorkspaceService, workspaceService)
    );

    const published = await Effect.runPromise(program);
    expect(published?.remoteLastModifiedDate).toBe('revision-4');
  });

  it('recognizes only metadata shadow paths in the workspace', () => {
    expect(
      isOrgMetadataShadowUri(workspaceUri, URI.file('/workspace/.sf/orgs/00D/metadata-shadow/ApexClass/Foo.cls'))
    ).toBe(true);
    expect(
      isOrgMetadataShadowUri(
        workspaceUri,
        URI.file('/workspace/.sf/orgs/00D/remoteMetadata/catalog-staging/ApexClass/Foo/revision.__staging__/Foo.cls')
      )
    ).toBe(true);
    expect(isOrgMetadataShadowUri(workspaceUri, URI.file('/workspace/.sf/orgs/00D/remoteMetadata/other/Foo.cls'))).toBe(
      false
    );
    expect(isOrgMetadataShadowUri(workspaceUri, URI.file('/workspace/force-app/Foo.cls'))).toBe(false);
    expect(
      isOrgMetadataShadowUri(URI.file('/other-workspace'), URI.file('/workspace/.sf/orgs/00D/metadata-shadow/Foo.cls'))
    ).toBe(false);
  });

  it('recognizes shadow paths when Windows drive-letter casing differs', () => {
    expect(
      isOrgMetadataShadowUri(
        URI.parse('file:///C:/workspace'),
        URI.parse('file:///c:/workspace/.sf/orgs/00D/metadata-shadow/ApexClass/Foo.cls')
      )
    ).toBe(true);
  });
});
