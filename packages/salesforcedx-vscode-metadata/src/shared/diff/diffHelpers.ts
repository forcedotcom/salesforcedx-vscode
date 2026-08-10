/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import type { HashableUri, OrgMetadataConsistency } from 'salesforcedx-vscode-services';
import { Utils } from 'vscode-uri';
import { createDiffFilePair, type DiffFilePair } from './diffTypes';

export const sourceComponentToPaths = (component: SourceComponent) =>
  [component.content, component.xml, ...component.walkContent()].filter(isString);

/**
 * Materialize complete remote source through OrgMetadataCatalog and match it to
 * project files by component identity and basename.
 *
 * @param localUriFilter - allowlist of local URIs to include in the result. Use when the caller already knows
 * which files the user acted on (e.g. right-click → diff on specific files) and wants to suppress pairs
 * for other files in the same component. Omit to include all files.
 * @param componentFilter - optional predicate applied before remote materialization. Use when the caller has
 * already narrowed candidate components through catalog metadata such as remote timestamps.
 * @param consistency - whether catalog shadow content may be reused or must be reacquired from the org.
 */
export const materializeRemoteComponents = Effect.fn('materializeRemoteComponents')(function* (
  projectComponentSet: ComponentSet,
  localUriFilter?: HashSet.HashSet<HashableUri>,
  componentFilter?: (component: SourceComponent) => boolean,
  consistency: OrgMetadataConsistency = 'cache-first'
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;

  const allProjectComponents = projectComponentSet.getSourceComponents().toArray();
  const projectComponents = componentFilter ? allProjectComponents.filter(componentFilter) : allProjectComponents;

  yield* Effect.annotateCurrentSpan({
    projectComponentCount: allProjectComponents.length,
    selectedProjectComponentCount: projectComponents.length,
    projectComponents: projectComponents.map(c => `${c.type.name}:${c.fullName}`)
  });

  const materialized = yield* api.services.OrgMetadataCatalog.materializeRemoteSources(
    projectComponents.map(component => ({ xmlName: component.type.name, fullName: component.fullName })),
    { consistency }
  );
  const artifacts = new Map(
    materialized.map(({ reference, artifact }) => [`${reference.xmlName}\0${reference.fullName}`, artifact])
  );

  return yield* Stream.fromIterable(projectComponents).pipe(
    Stream.flatMap(projectComp => {
      const artifact = artifacts.get(`${projectComp.type.name}\0${projectComp.fullName}`);
      if (!artifact) return Stream.empty;
      // basename → remote path, built once per component pair so we never cross-match
      // between components that share filenames (e.g. two LWCs both having helper.js).
      const byBasename = new Map(artifact.fileUris.map(uri => [Utils.basename(uri), uri]));
      return Stream.fromIterable(sourceComponentToPaths(projectComp)).pipe(
        Stream.mapEffect(p => fsService.toUri(p).pipe(Effect.map(uri => fsService.HashableUri.fromUri(uri)))),
        Stream.filter(u => !localUriFilter || HashSet.has(localUriFilter, u)),
        Stream.filterMap(localUri =>
          Option.fromNullable(byBasename.get(Utils.basename(localUri.uri))).pipe(
            Option.map(remoteUri => ({ localUri, remoteUri }))
          )
        ),
        Stream.map(({ localUri, remoteUri }) =>
          createDiffFilePair({
            localUri,
            remoteUri: fsService.HashableUri.fromUri(remoteUri),
            fileName: Utils.basename(localUri.uri)
          })
        )
      );
    }),
    Stream.runCollect,
    Effect.map(HashSet.fromIterable)
  );
});

/** Check if two files differ in content, ignoring whitespace */
export const filesAreNotIdentical = Effect.fn('filesAreNotIdentical')(function* (pair: DiffFilePair) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [buffer1, buffer2] = (yield* Effect.all(
    [api.services.FsService.readFile(pair.remoteUri.uri), api.services.FsService.readFile(pair.localUri.uri)],
    { concurrency: 'unbounded' }
  ).pipe(
    Effect.tapError(e => Effect.logWarning('filesAreNotIdentical: readFile failed, skipping pair', e)),
    Effect.orElseSucceed(() => ['', ''] as const)
    // normalize whitespace
  )).map((s: string) => s.replaceAll(/\s+/g, ''));
  return buffer1 !== buffer2;
});
