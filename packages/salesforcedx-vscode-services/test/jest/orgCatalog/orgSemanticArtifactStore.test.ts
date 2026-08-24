/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { URI, Utils } from 'vscode-uri';
import {
  ORG_SEMANTIC_ARTIFACT_REVISIONS_TO_KEEP,
  OrgSemanticArtifactStore,
  type SemanticArtifactStoreKey
} from '../../../src/orgCatalog/orgSemanticArtifactStore';
import { FsService } from '../../../src/vscode/fsService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

const workspaceUri = URI.file('/workspace');

const sobjectKey = (
  orgId: string,
  namespace: string | null = null,
  revision: string | null = 'revision-1'
): SemanticArtifactStoreKey => ({
  orgId,
  identity: { kind: 'sobject', namespace, name: 'Invoice__c' },
  projection: { kind: 'semantic-model', model: 'sobject' },
  provider: 'rest-api',
  capabilityVersion: '66.0',
  revision
});

const makeHarness = () => {
  const files = new Map<string, string>();
  const writes: string[] = [];
  const renames: Array<readonly [string, string, { readonly overwrite?: boolean } | undefined]> = [];
  const failedWrites = new Set<string>();
  const fsService = new FsService({
    fileOrFolderExists: (uri: URI) => Effect.succeed(files.has(uri.toString())),
    safeDelete: (uri: URI) =>
      Effect.sync(() => {
        files.delete(uri.toString());
      }),
    safeWriteFile: (uri: URI, content: string) =>
      failedWrites.has(uri.toString())
        ? Effect.fail(new Error(`failed to write ${uri.toString()}`))
        : Effect.sync(() => {
            writes.push(uri.toString());
            files.set(uri.toString(), content);
          }),
    rename: (from: string, to: string, options?: { readonly overwrite?: boolean }) =>
      Effect.sync(() => {
        renames.push([from, to, options]);
        const content = files.get(from);
        files.delete(from);
        if (content !== undefined) files.set(to, content);
      }),
    readJSON: <A>(path: string, schema: Schema.Schema<A>) => {
      const content = files.get(path);
      if (content === undefined) return Effect.fail(new Error('not found'));
      return Effect.try({ try: () => JSON.parse(content), catch: cause => new Error(String(cause)) }).pipe(
        Effect.flatMap(Schema.decodeUnknown(schema))
      );
    },
    readDirectory: (uri: URI) =>
      Effect.sync(() => {
        const prefix = `${uri.toString()}/`;
        return [...files.keys()]
          .filter(path => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
          .map(path => Utils.joinPath(uri, path.slice(prefix.length)));
      })
  } as unknown as FsService);
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
  const run = <A, E>(effect: Effect.Effect<A, E, OrgSemanticArtifactStore>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provide(OrgSemanticArtifactStore.DefaultWithoutDependencies),
        Effect.provideService(FsService, fsService),
        Effect.provideService(WorkspaceService, workspaceService)
      )
    );
  return { failedWrites, files, renames, run, writes };
};

describe('OrgSemanticArtifactStore', () => {
  it('atomically publishes and rehydrates an opaque semantic artifact after restart', async () => {
    const { renames, run, writes } = makeHarness();
    const key = sobjectKey('00D-one');
    const value = { kind: 'sobject', label: 'Invoice' };

    const stored = await run(
      Effect.gen(function* () {
        return yield* (yield* OrgSemanticArtifactStore).save(key, value);
      })
    );
    const rehydrated = await run(
      Effect.gen(function* () {
        return yield* (yield* OrgSemanticArtifactStore).load(key);
      })
    );

    expect(stored.uri.path).toContain(
      '/.sf/orgs/00D-one/semantic-artifacts/sobject/global/invoice__c/sobject/rest-api/66.0/revisions/revision-revision-1.json'
    );
    expect(writes).toEqual([`${stored.uri.toString()}.__staging__`]);
    expect(renames).toEqual([[`${stored.uri.toString()}.__staging__`, stored.uri.toString(), { overwrite: true }]]);
    expect(rehydrated).toMatchObject({ key, value });
  });

  it('isolates identical semantic identities by org', async () => {
    const { run } = makeHarness();
    const firstKey = sobjectKey('org-one');
    const secondKey = sobjectKey('org-two');

    const [first, second] = await run(
      Effect.gen(function* () {
        const store = yield* OrgSemanticArtifactStore;
        yield* store.save(firstKey, { label: 'First org' });
        yield* store.save(secondKey, { label: 'Second org' });
        return yield* Effect.all([store.load(firstKey), store.load(secondKey)]);
      })
    );

    expect(first?.value).toEqual({ label: 'First org' });
    expect(second?.value).toEqual({ label: 'Second org' });
    expect(first?.uri.toString()).not.toBe(second?.uri.toString());
  });

  it('keeps global and namespaced artifacts with the same name separate', async () => {
    const { run } = makeHarness();
    const globalKey = sobjectKey('00D', null);
    const packageKey = sobjectKey('00D', 'MyPackage');
    const lowercasePackageKey = sobjectKey('00D', 'mypackage');

    const [global, namespaced] = await run(
      Effect.gen(function* () {
        const store = yield* OrgSemanticArtifactStore;
        yield* store.save(globalKey, { label: 'Global invoice' });
        yield* store.save(packageKey, { label: 'Package invoice' });
        return yield* Effect.all([store.load(globalKey), store.load(lowercasePackageKey)]);
      })
    );

    expect(global?.value).toEqual({ label: 'Global invoice' });
    expect(namespaced?.value).toEqual({ label: 'Package invoice' });
    expect(global?.uri.toString()).not.toBe(namespaced?.uri.toString());
  });

  it('rejects corrupt persisted manifests', async () => {
    const { files, run } = makeHarness();
    const key = sobjectKey('00D');
    const uri = await run(
      Effect.gen(function* () {
        return yield* (yield* OrgSemanticArtifactStore).getUri(key);
      })
    );
    files.set(uri.toString(), JSON.stringify({ version: 99, value: {} }));

    await expect(
      run(
        Effect.gen(function* () {
          return yield* (yield* OrgSemanticArtifactStore).load(key);
        })
      )
    ).rejects.toThrow();
  });

  it('does not replace a published revision when its staging write fails', async () => {
    const { failedWrites, run } = makeHarness();
    const key = sobjectKey('00D');

    await run(
      Effect.gen(function* () {
        const store = yield* OrgSemanticArtifactStore;
        const stored = yield* store.save(key, { label: 'Published' });
        failedWrites.add(`${stored.uri.toString()}.__staging__`);
        return yield* store.save(key, { label: 'Not published' });
      })
    ).catch(() => undefined);
    const loaded = await run(
      Effect.gen(function* () {
        return yield* (yield* OrgSemanticArtifactStore).load(key);
      })
    );

    expect(loaded?.value).toEqual({ label: 'Published' });
  });

  it('retains only the newest bounded revisions for one provider capability', async () => {
    const { run } = makeHarness();
    const revisions = Array.from(
      { length: ORG_SEMANTIC_ARTIFACT_REVISIONS_TO_KEEP + 1 },
      (_, index) => `revision-${index + 1}`
    );

    const artifacts = await run(
      Effect.gen(function* () {
        const store = yield* OrgSemanticArtifactStore;
        yield* Effect.forEach(
          revisions,
          (revision, index) => store.save(sobjectKey('00D', null, revision), { index }),
          { concurrency: 1 }
        );
        return yield* Effect.forEach(revisions, revision => store.load(sobjectKey('00D', null, revision)), {
          concurrency: 1
        });
      })
    );

    expect(artifacts[0]).toBeUndefined();
    expect(artifacts.slice(1).every(artifact => artifact !== undefined)).toBe(true);
  });

  it('returns undefined when no semantic artifact has been persisted', async () => {
    const { run } = makeHarness();
    const loaded = await run(
      Effect.gen(function* () {
        return yield* (yield* OrgSemanticArtifactStore).load(sobjectKey('missing'));
      })
    );

    expect(loaded).toBeUndefined();
  });
});
