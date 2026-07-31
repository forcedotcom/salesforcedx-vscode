/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import {
  isOrgMetadataCatalogUri,
  OrgMetadataCatalogStore,
  type OrgMetadataCatalogSnapshot
} from '../../../src/orgCatalog/orgMetadataCatalogStore';
import { FsService } from '../../../src/vscode/fsService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

const workspaceUri = URI.file('/workspace');

const snapshot = (orgId: string, generation = 1): OrgMetadataCatalogSnapshot => ({
  version: 1,
  orgId,
  writtenAt: '2026-07-31T12:00:00.000Z',
  generation,
  inventory: [
    {
      xmlName: 'ApexClass',
      observedAt: '2026-07-31T11:59:00.000Z',
      components: [{ fullName: 'FooTest', lastModifiedDate: '2026-07-31T11:58:00.000Z' }],
      folders: []
    }
  ],
  sobjects: { descriptions: [] },
  tracking: [{ xmlName: 'ApexClass', fullName: 'FooTest', signature: 'Changed|1' }]
});

const makeHarness = () => {
  const files = new Map<string, string>();
  const writes: string[] = [];
  const renames: Array<readonly [string, string, { readonly overwrite?: boolean } | undefined]> = [];
  const fsService = new FsService({
    fileOrFolderExists: (uri: URI) => Effect.succeed(files.has(uri.toString())),
    safeWriteFile: (uri: URI, content: string) =>
      Effect.sync(() => {
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
      return content === undefined
        ? Effect.fail(new Error('not found'))
        : Schema.decodeUnknown(schema)(JSON.parse(content));
    }
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
  const run = <A, E>(effect: Effect.Effect<A, E, OrgMetadataCatalogStore>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provide(OrgMetadataCatalogStore.DefaultWithoutDependencies),
        Effect.provideService(FsService, fsService),
        Effect.provideService(WorkspaceService, workspaceService)
      )
    );
  return { files, renames, run, writes };
};

describe('OrgMetadataCatalogStore', () => {
  it('recognizes only catalog checkpoint paths in the workspace', () => {
    expect(
      isOrgMetadataCatalogUri(workspaceUri, URI.file('/workspace/.sf/orgs/00D/metadata-catalog/catalog.json'))
    ).toBe(true);
    expect(isOrgMetadataCatalogUri(workspaceUri, URI.file('/workspace/force-app/Foo.cls'))).toBe(false);
    expect(
      isOrgMetadataCatalogUri(
        URI.file('/other-workspace'),
        URI.file('/workspace/.sf/orgs/00D/metadata-catalog/catalog.json')
      )
    ).toBe(false);
  });

  it('atomically publishes and reloads a schema-valid per-org snapshot', async () => {
    const { files, renames, run, writes } = makeHarness();
    const stored = snapshot('00D-one');

    const [uri, loaded] = await run(
      Effect.gen(function* () {
        const store = yield* OrgMetadataCatalogStore;
        const savedUri = yield* store.save(stored);
        return [savedUri, yield* store.load('00D-one')] as const;
      })
    );

    expect(uri.path).toBe('/workspace/.sf/orgs/00D-one/metadata-catalog/catalog.json');
    expect(loaded).toEqual(stored);
    expect(writes).toEqual([`${uri.toString()}.__staging__`]);
    expect(renames).toEqual([[`${uri.toString()}.__staging__`, uri.toString(), { overwrite: true }]]);
    expect(files.get(uri.toString())).toContain('\n  "version": 1,\n');
    expect(files.get(uri.toString())).toContain('\n      "xmlName": "ApexClass",\n');
  });

  it('rejects a snapshot stored beneath a different org partition', async () => {
    const { files, run } = makeHarness();
    files.set('file:///workspace/.sf/orgs/00D-two/metadata-catalog/catalog.json', JSON.stringify(snapshot('00D-one')));

    await expect(
      run(
        Effect.gen(function* () {
          return yield* (yield* OrgMetadataCatalogStore).load('00D-two');
        })
      )
    ).rejects.toThrow("Catalog snapshot org '00D-one' does not match '00D-two'");
  });

  it('returns no snapshot when the org has not been persisted', async () => {
    const { run } = makeHarness();
    const loaded = await run(
      Effect.gen(function* () {
        return yield* (yield* OrgMetadataCatalogStore).load('00D-missing');
      })
    );

    expect(loaded).toBeUndefined();
  });
});
