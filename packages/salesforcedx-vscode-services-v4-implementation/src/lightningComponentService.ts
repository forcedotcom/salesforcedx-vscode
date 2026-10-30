/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  FsService,
  LightningComponentService,
  type LightningComponentKind,
  type RenameBundleParams
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import { type URI, Utils } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

const bundleFilePattern = (name: string, kind: LightningComponentKind): RegExp => {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return kind === 'lwc'
    ? new RegExp(`^${escaped}\\.(html|js|ts|js-meta\\.xml|css|svg|test\\.js|test\\.ts)$`)
    : new RegExp(`^${escaped}((Controller|Renderer|Helper)?\\.js|\\.(cmp|app|css|design|auradoc|svg|evt))$`);
};

export const LightningComponentServiceLayer = Layer.effect(
  LightningComponentService,
  Effect.gen(function* () {
    const fs = yield* FsService;
    const operations = yield* ServiceOperations;
    const bundleEntries = (bundleUri: URI) =>
      Stream.unwrap(
        fs
          .readDirectory(bundleUri)
          .pipe(
            Effect.map(top =>
              Stream.fromIterable(top).pipe(
                Stream.flatMap(child =>
                  Utils.basename(child) === '__tests__'
                    ? Stream.unwrap(
                        fs
                          .readDirectory(child)
                          .pipe(Effect.map(tests => Stream.fromIterable(tests.map(uri => ({ uri, inTests: true })))))
                      )
                    : Stream.make({ uri: child, inTests: false })
                )
              )
            )
          )
      );
    const renameBundle = Effect.fn('LightningComponentService.renameBundle')(function* (params: RenameBundleParams) {
      const { bundleUri, oldName, newName, kind } = params;
      const pattern = bundleFilePattern(oldName, kind);
      yield* bundleEntries(bundleUri).pipe(
        Stream.filter(({ uri, inTests }) => {
          const name = Utils.basename(uri);
          return inTests ? name.includes(oldName) : pattern.test(name);
        }),
        Stream.runForEach(({ uri }) =>
          fs
            .rename(
              uri.toString(),
              Utils.joinPath(Utils.dirname(uri), Utils.basename(uri).replaceAll(oldName, newName)).toString()
            )
            // Drain each started host mutation, not the whole multi-file rename pipeline.
            .pipe(Effect.uninterruptible)
        )
      );
      const renamed = Utils.joinPath(Utils.dirname(bundleUri), newName);
      yield* fs.rename(bundleUri.toString(), renamed.toString()).pipe(Effect.uninterruptible);
      return renamed;
    }, operations.run);
    yield* Effect.addFinalizer(() => operations.close);
    return LightningComponentService.of({ renameBundle });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
