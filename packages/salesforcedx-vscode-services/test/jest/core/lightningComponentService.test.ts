/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI, Utils } from 'vscode-uri';
import { LightningComponentService } from '../../../src/core/lightningComponentService';
import { FsService } from '../../../src/vscode/fsService';

/** In-memory filesystem stub: paths -> children URIs. Mutates on rename. */
const buildFakeFs = (initial: Map<string, URI[]>) => {
  const entries = new Map(Array.from(initial, ([k, v]) => [k, [...v]] as const));
  const renames: [string, string][] = [];

  const readDirectory = (path: string | URI) => {
    const key = typeof path === 'string' ? path : path.toString();
    const result = entries.get(key);
    return result === undefined
      ? Effect.fail(new Error(`readDirectory miss: ${key}`))
      : Effect.succeed(result.map(uri => uri));
  };

  const rename = (oldPath: string, newPath: string) =>
    Effect.sync(() => {
      renames.push([oldPath, newPath]);
      // Move the URI inside its parent directory entries
      const oldUri = URI.parse(oldPath);
      const newUri = URI.parse(newPath);
      const parent = Utils.dirname(oldUri).toString();
      const siblings = entries.get(parent);
      if (siblings) {
        entries.set(
          parent,
          siblings.map(u => (u.toString() === oldPath ? newUri : u))
        );
      }
      // If oldPath was a directory we tracked, move its child list under the new key
      if (entries.has(oldPath)) {
        entries.set(newPath, entries.get(oldPath)!);
        entries.delete(oldPath);
      }
    });

  return { readDirectory, rename, renames, entries };
};

const buildLayer = (fake: ReturnType<typeof buildFakeFs>): Layer.Layer<LightningComponentService, never, never> => {
  const fsLayer = Layer.succeed(FsService, {
    readDirectory: fake.readDirectory,
    rename: fake.rename
  } as unknown as FsService);
  return Layer.provide(LightningComponentService.DefaultWithoutDependencies, fsLayer);
};

describe('LightningComponentService.renameBundle', () => {
  it('renames every file in __tests__ whose name contains the old bundle name', async () => {
    const bundleUri = URI.parse('file:///proj/lwc/propertyTile');
    const testsUri = URI.parse('file:///proj/lwc/propertyTile/__tests__');

    const fake = buildFakeFs(
      new Map([
        [
          bundleUri.toString(),
          [
            Utils.joinPath(bundleUri, 'propertyTile.html'),
            Utils.joinPath(bundleUri, 'propertyTile.js'),
            Utils.joinPath(bundleUri, 'propertyTile.js-meta.xml'),
            Utils.joinPath(bundleUri, '__tests__')
          ]
        ],
        [
          testsUri.toString(),
          [
            Utils.joinPath(testsUri, 'propertyTile.test.js'),
            Utils.joinPath(testsUri, 'propertyTile.small.test.js'),
            Utils.joinPath(testsUri, 'propertyTile.foo.bar.test.js'),
            Utils.joinPath(testsUri, 'unrelated.test.js')
          ]
        ]
      ])
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* LightningComponentService;
        return yield* svc.renameBundle({
          bundleUri,
          oldName: 'propertyTile',
          newName: 'propertyTile1',
          kind: 'lwc'
        });
      }).pipe(Effect.provide(buildLayer(fake)))
    );

    const renamePairs = fake.renames.map(([from, to]) => [
      Utils.basename(URI.parse(from)),
      Utils.basename(URI.parse(to))
    ]);

    // Bundle top-level files renamed via strict pattern
    expect(renamePairs).toEqual(
      expect.arrayContaining([
        ['propertyTile.html', 'propertyTile1.html'],
        ['propertyTile.js', 'propertyTile1.js'],
        ['propertyTile.js-meta.xml', 'propertyTile1.js-meta.xml']
      ])
    );

    // __tests__ files renamed via fuzzy substring match — the regression case
    expect(renamePairs).toEqual(
      expect.arrayContaining([
        ['propertyTile.test.js', 'propertyTile1.test.js'],
        ['propertyTile.small.test.js', 'propertyTile1.small.test.js'],
        ['propertyTile.foo.bar.test.js', 'propertyTile1.foo.bar.test.js']
      ])
    );

    // Unrelated test file is left alone
    expect(renamePairs).not.toEqual(expect.arrayContaining([['unrelated.test.js', expect.anything()]]));

    // Bundle directory itself is renamed last
    expect(fake.renames.at(-1)).toEqual([bundleUri.toString(), 'file:///proj/lwc/propertyTile1']);
  });

  it('does not touch top-level files that merely contain the old name as a substring', async () => {
    const bundleUri = URI.parse('file:///proj/lwc/foo');

    const fake = buildFakeFs(
      new Map([
        [
          bundleUri.toString(),
          [
            Utils.joinPath(bundleUri, 'foo.html'),
            Utils.joinPath(bundleUri, 'foo.js'),
            // these must NOT be renamed — they don't match the strict pattern
            Utils.joinPath(bundleUri, 'foo-extra.css'),
            Utils.joinPath(bundleUri, 'fooHelper.txt')
          ]
        ]
      ])
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* LightningComponentService;
        return yield* svc.renameBundle({
          bundleUri,
          oldName: 'foo',
          newName: 'bar',
          kind: 'lwc'
        });
      }).pipe(Effect.provide(buildLayer(fake)))
    );

    const renamedNames = fake.renames.map(([from]) => Utils.basename(URI.parse(from)));
    expect(renamedNames).toContain('foo.html');
    expect(renamedNames).toContain('foo.js');
    expect(renamedNames).not.toContain('foo-extra.css');
    expect(renamedNames).not.toContain('fooHelper.txt');
  });

  it('replaces all occurrences of the old name in a single filename', async () => {
    const bundleUri = URI.parse('file:///proj/lwc/foo');
    const testsUri = URI.parse('file:///proj/lwc/foo/__tests__');

    const fake = buildFakeFs(
      new Map([
        [bundleUri.toString(), [Utils.joinPath(bundleUri, '__tests__')]],
        // pathological but real: name like 'foo.foo.test.js' should become 'bar.bar.test.js'
        [testsUri.toString(), [Utils.joinPath(testsUri, 'foo.foo.test.js')]]
      ])
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* LightningComponentService;
        return yield* svc.renameBundle({
          bundleUri,
          oldName: 'foo',
          newName: 'bar',
          kind: 'lwc'
        });
      }).pipe(Effect.provide(buildLayer(fake)))
    );

    const testRename = fake.renames.find(([from]) => Utils.basename(URI.parse(from)) === 'foo.foo.test.js');
    expect(testRename).toBeDefined();
    expect(Utils.basename(URI.parse(testRename![1]))).toBe('bar.bar.test.js');
  });
});
