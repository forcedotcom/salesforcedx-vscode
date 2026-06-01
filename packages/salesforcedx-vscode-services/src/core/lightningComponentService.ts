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

      /** Stream the immediate children of `bundleUri`, recursing into a top-level `__tests__/` if present. */
      const bundleEntries = (bundleUri: URI) =>
        Stream.unwrap(
          Effect.map(fs.readDirectory(bundleUri), top =>
            Stream.fromIterable(top).pipe(
              Stream.flatMap(child =>
                Utils.basename(child) === TEST_FOLDER
                  ? Stream.unwrap(Effect.map(fs.readDirectory(child), Stream.fromIterable))
                  : Stream.make(child)
              )
            )
          )
        );

      /** Rename all files in the bundle (and __tests__) that match the bundle's name pattern, then
       * rename the bundle directory itself. Returns the new bundle URI. */
      const renameBundle = Effect.fn('LightningComponentService.renameBundle')(function* (params: RenameBundleParams) {
        const { bundleUri, oldName, newName, kind } = params;
        const oldPattern = bundleFilePattern(oldName, kind);

        yield* bundleEntries(bundleUri).pipe(
          Stream.filter(child => oldPattern.test(Utils.basename(child))),
          Stream.runForEach(child => {
            const name = Utils.basename(child);
            const newChild = Utils.joinPath(Utils.dirname(child), name.replace(oldName, newName));
            return fs.rename(child.toString(), newChild.toString());
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
