/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { type URI, Utils } from 'vscode-uri';
import { FsService } from '../vscode/fsService';

const TEST_FOLDER = '__tests__';

export type LightningComponentKind = 'lwc' | 'aura';

/** Pattern of bundle filenames that should be renamed when the bundle name changes.
 * LWC: <name>.{html,js,ts,js-meta.xml,css,svg,test.js,test.ts}
 * Aura: <name>{Controller|Renderer|Helper}?.js, <name>.{cmp,app,css,design,auradoc,svg,evt} */
const bundleFilePattern = (componentName: string, kind: LightningComponentKind): RegExp => {
  const escaped = componentName.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return kind === 'lwc'
    ? new RegExp(`^${escaped}\\.(html|js|ts|js-meta\\.xml|css|svg|test\\.js|test\\.ts)$`)
    : new RegExp(`^${escaped}((Controller|Renderer|Helper)?\\.js|\\.(cmp|app|css|design|auradoc|svg|evt))$`);
};

export type RenameBundleParams = {
  bundleUri: URI;
  oldName: string;
  newName: string;
  kind: LightningComponentKind;
};

export class LightningComponentService extends Effect.Service<LightningComponentService>()(
  'LightningComponentService',
  {
    accessors: true,
    dependencies: [FsService.Default],
    effect: Effect.gen(function* () {
      const fs = yield* FsService;

      /** Stream the immediate children of `bundleUri`, recursing into a top-level `__tests__/` if present.
       * Each emitted entry is tagged so callers can apply different match rules to test files vs. bundle
       * top-level files (test files use a fuzzy substring match; top-level files use a strict pattern). */
      const bundleEntries = (bundleUri: URI): Stream.Stream<{ uri: URI; inTests: boolean }, unknown> =>
        Stream.unwrap(
          Effect.map(fs.readDirectory(bundleUri), top =>
            Stream.fromIterable(top).pipe(
              Stream.flatMap(child =>
                Utils.basename(child) === TEST_FOLDER
                  ? Stream.unwrap(
                      Effect.map(fs.readDirectory(child), tests =>
                        Stream.fromIterable(tests.map(uri => ({ uri, inTests: true })))
                      )
                    )
                  : Stream.make({ uri: child, inTests: false })
              )
            )
          )
        );

      /** Rename matching files in the bundle (and __tests__), then rename the bundle directory. Returns the new URI.
       * Match rules:
       * Top-level bundle files: strict pattern (e.g. `<oldName>.html`, `<oldName>Controller.js`).
       * `__tests__/` files: any file whose name contains `<oldName>` (case-sensitive substring) —
       * covers `<oldName>.test.js`, `<oldName>.small.test.js`, `<oldName>.foo.bar.test.js`, etc.
       * Without this, files like `propertyTile.small.test.js` are left behind on rename, leaving
       * the bundle in a half-renamed state. */
      const renameBundle = Effect.fn('LightningComponentService.renameBundle')(function* (params: RenameBundleParams) {
        const { bundleUri, oldName, newName, kind } = params;
        const oldPattern = bundleFilePattern(oldName, kind);

        yield* bundleEntries(bundleUri).pipe(
          Stream.filter(({ uri, inTests }) => {
            const name = Utils.basename(uri);
            return inTests ? name.includes(oldName) : oldPattern.test(name);
          }),
          Stream.runForEach(({ uri }) => {
            const name = Utils.basename(uri);
            const newChild = Utils.joinPath(Utils.dirname(uri), name.replaceAll(oldName, newName));
            return fs.rename(uri.toString(), newChild.toString());
          })
        );

        const newBundleUri = Utils.joinPath(Utils.dirname(bundleUri), newName);
        yield* fs.rename(bundleUri.toString(), newBundleUri.toString());
        return newBundleUri;
      });

      return { renameBundle };
    })
  }
) {}
