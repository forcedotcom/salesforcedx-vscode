/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SObjectShortDescription, SObjectsStandardAndCustom } from '../sobjects/describeTypes';
import type { SObjectCategory, SObjectRefreshResult, SObjectRefreshSource } from '../sobjects/types/general';
import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as path from 'node:path';
import type { SObject } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { generateSObjectDefinition } from '../sobjects/declarationGenerator';
import { generateFauxClassText } from '../sobjects/fauxClassGenerator';
import { sobjectTypeFilter } from '../sobjects/sobjectFilter';
import { generateTypeText } from '../sobjects/typingGenerator';

const APEX_CLASS_EXTENSION = '.cls';
const TYPESCRIPT_TYPE_EXT = '.d.ts';
// vscode.workspace.fs.writeFile adds ~90ms latency per call vs node:fs.
// Each SObject slot awaits 3 parallel writes; slots are I/O-bound not CPU-bound.
// Higher concurrency reduces the number of rounds and directly cuts Phase 3 time.
const WRITE_CONCURRENCY = 100;

/**
 * TypeScript's overload resolution for Stream.mapEffect fails to infer the element type
 * when the stream originates from a service class accessor. This generic wrapper
 * forces correct type inference through generic parameter binding.
 */
const typedMapEffect = <A, E, R, A2, E2, R2>(
  stream: Stream.Stream<A, E, R>,
  f: (a: A) => Effect.Effect<A2, E2, R2>,
  options?: { readonly concurrency?: number | 'unbounded' }
): Stream.Stream<A2, E | E2, R | R2> => Stream.mapEffect(stream, f, options);


/**
 * Streaming write effect for the normal refresh path.
 *
 * Everything runs in a single Effect.provide(mergedLayer) so listSObjects and
 * describeCustomObjects share ONE MetadataDescribeService instance (one connection).
 *
 * Phase 1: listSObjects + reset all 5 output dirs (parallel)
 * Phase 2: write typeNames.json (needs listSObjects result)
 * Phase 3: describeCustomObjects stream → toMinimal → 3 file writes per SObject
 */
const runStreamWriteEffect = (
  category: SObjectCategory,
  source: Exclude<SObjectRefreshSource, 'startupmin'>
) =>
  Effect.gen(function* () {
    const api = yield* getServicesApi;
    const fsLayer = api.services.FsService.Default;
    const mdLayer = api.services.MetadataDescribeService.Default;
    const projectLayer = api.services.ProjectService.Default;
    const txLayer = api.services.TransmogrifierService.Default;
    const fs = api.services.FsService;

    return yield* Effect.gen(function* () {
      const [fauxStandard, fauxCustom, typings, soqlMeta, soqlStandard, soqlCustom] = yield* Effect.all(
        [
          api.services.ProjectService.getFauxStandardObjectsPath(),
          api.services.ProjectService.getFauxCustomObjectsPath(),
          api.services.ProjectService.getTypingsPath(),
          api.services.ProjectService.getSoqlMetadataPath(),
          api.services.ProjectService.getSoqlStandardObjectsPath(),
          api.services.ProjectService.getSoqlCustomObjectsPath()
        ],
        { concurrency: 'unbounded' }
      );

      // Phase 1: listSObjects and dir resets run in parallel — saves ~0.5s
      const [allSObjects] = yield* Effect.all(
        [
          api.services.MetadataDescribeService.listSObjects(),
          Effect.all(
            [
              fs.safeDelete(fauxStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(fauxStandard))),
              fs.safeDelete(fauxCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(fauxCustom))),
              fs.safeDelete(typings, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(typings))),
              fs.safeDelete(soqlStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(soqlStandard))),
              fs.safeDelete(soqlCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(soqlCustom)))
            ],
            { concurrency: 'unbounded' }
          )
        ],
        { concurrency: 'unbounded' }
      );
      const sobjectNames = allSObjects.filter(sobjectTypeFilter(category, source));

      // Phase 2: typeNames.json — sobjectNames known, dirs ready
      yield* fs.writeFile(path.join(soqlMeta, 'typeNames.json'), JSON.stringify(sobjectNames, null, 2));

      // Phase 3: describe stream + file writes overlapped.
      // listSObjects and describeCustomObjects share the same MetadataDescribeService
      // instance (one connection) because both run inside the same Effect.provide below.
      // Dirs are pre-created in Phase 1, so writeFile has no createDirectory overhead.
      const standardRef = yield* Ref.make(0);
      const customRef = yield* Ref.make(0);

      const describeStream = Stream.flatten(
        api.services.MetadataDescribeService.describeCustomObjects(sobjectNames.map(s => s.name))
      );

      yield* Stream.runDrain(
        typedMapEffect(
          describeStream,
          raw => Effect.gen(function* () {
            const sobject = yield* api.services.TransmogrifierService.toMinimalSObject(raw);
            const isCustom = sobject.custom;
            const fauxDir = isCustom ? fauxCustom : fauxStandard;
            const soqlDir = isCustom ? soqlCustom : soqlStandard;
            const definition = generateSObjectDefinition(sobject);
            const countRef = isCustom ? customRef : standardRef;
            return yield* Effect.all(
              [
                fs.writeFile(path.join(fauxDir, `${sobject.name}${APEX_CLASS_EXTENSION}`), generateFauxClassText(definition)),
                fs.writeFile(path.join(typings, `${sobject.name}${TYPESCRIPT_TYPE_EXT}`), generateTypeText(definition)),
                fs.writeFile(path.join(soqlDir, `${sobject.name}.json`), JSON.stringify(sobject, null, 2)),
                Ref.update(countRef, n => n + 1)
              ],
              { concurrency: 'unbounded' }
            );
          }),
          { concurrency: WRITE_CONCURRENCY }
        )
      );

      return [yield* Ref.get(standardRef), yield* Ref.get(customRef)] as const;
    }).pipe(
      // Single merged layer: all services built once and shared across all phases.
      Effect.provide(Layer.mergeAll(fsLayer, mdLayer, projectLayer, txLayer))
    );
  });

/**
 * Core write effect for the startupmin path.
 * Accepts a pre-built stream of minimal SObjects — no describe call needed.
 */
const runWriteEffect = (sobjectStream: Stream.Stream<SObject>, sobjectNames: SObjectShortDescription[]) =>
  Effect.gen(function* () {
    const api = yield* getServicesApi;
    const fsLayer = api.services.FsService.Default;
    const projectLayer = api.services.ProjectService.Default;
    const fs = api.services.FsService;

    return yield* Effect.gen(function* () {
      const [fauxStandard, fauxCustom, typings, soqlMeta, soqlStandard, soqlCustom] = yield* Effect.all(
        [
          api.services.ProjectService.getFauxStandardObjectsPath(),
          api.services.ProjectService.getFauxCustomObjectsPath(),
          api.services.ProjectService.getTypingsPath(),
          api.services.ProjectService.getSoqlMetadataPath(),
          api.services.ProjectService.getSoqlStandardObjectsPath(),
          api.services.ProjectService.getSoqlCustomObjectsPath()
        ],
        { concurrency: 'unbounded' }
      );
      yield* Effect.all(
        [
          fs.safeDelete(fauxStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(fauxStandard))),
          fs.safeDelete(fauxCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(fauxCustom))),
          fs.safeDelete(typings, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(typings))),
          fs.safeDelete(soqlStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(soqlStandard))),
          fs.safeDelete(soqlCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(soqlCustom))),
          fs.writeFile(path.join(soqlMeta, 'typeNames.json'), JSON.stringify(sobjectNames, null, 2))
        ],
        { concurrency: 'unbounded' }
      );

      const standardRef = yield* Ref.make(0);
      const customRef = yield* Ref.make(0);

      yield* sobjectStream.pipe(
        Stream.mapEffect(
          sobject => {
            const isCustom = sobject.custom;
            const fauxDir = isCustom ? fauxCustom : fauxStandard;
            const soqlDir = isCustom ? soqlCustom : soqlStandard;
            const definition = generateSObjectDefinition(sobject);
            const countRef = isCustom ? customRef : standardRef;
            return Effect.all(
              [
                fs.writeFile(path.join(fauxDir, `${sobject.name}${APEX_CLASS_EXTENSION}`), generateFauxClassText(definition)),
                fs.writeFile(path.join(typings, `${sobject.name}${TYPESCRIPT_TYPE_EXT}`), generateTypeText(definition)),
                fs.writeFile(path.join(soqlDir, `${sobject.name}.json`), JSON.stringify(sobject, null, 2)),
                Ref.update(countRef, n => n + 1)
              ],
              { concurrency: 'unbounded' }
            );
          },
          { concurrency: WRITE_CONCURRENCY }
        ),
        Stream.runDrain
      );

      return [yield* Ref.get(standardRef), yield* Ref.get(customRef)] as const;
    }).pipe(Effect.provide(Layer.merge(fsLayer, projectLayer)));
  });

type StreamWriterArgs = {
  cancellationToken: vscode.CancellationToken;
  category: SObjectCategory;
  source: Exclude<SObjectRefreshSource, 'startupmin'>;
};

/**
 * Streaming path: listSObjects, dir resets, describe + writes all in one shared Effect scope.
 * One connection, one layer build, maximum I/O overlap.
 */
export const streamAndWriteSobjectArtifacts = async (args: StreamWriterArgs): Promise<SObjectRefreshResult> => {
  const { cancellationToken, category, source } = args;
  if (cancellationToken.isCancellationRequested) {
    return { data: { cancelled: true, standardObjects: 0, customObjects: 0 } };
  }
  const [standardCount, customCount] = await Effect.runPromise(runStreamWriteEffect(category, source));
  return {
    data: {
      cancelled: cancellationToken.isCancellationRequested,
      standardObjects: standardCount,
      customObjects: customCount
    }
  };
};

type StaticWriterArgs = {
  cancellationToken: vscode.CancellationToken;
  sobjects: SObjectsStandardAndCustom;
  sobjectNames: SObjectShortDescription[];
};

/**
 * Static path: used by startupmin which supplies pre-fetched bundled SObjects.
 */
export const writeSobjectArtifacts = async (args: StaticWriterArgs): Promise<SObjectRefreshResult> => {
  const { cancellationToken, sobjects, sobjectNames } = args;
  if (cancellationToken.isCancellationRequested) {
    return { data: { cancelled: true, standardObjects: 0, customObjects: 0 } };
  }
  const sobjectStream = Stream.fromIterable<SObject>([...sobjects.standard, ...sobjects.custom]);
  const [standardCount, customCount] = await Effect.runPromise(runWriteEffect(sobjectStream, sobjectNames));
  return {
    data: {
      cancelled: cancellationToken.isCancellationRequested,
      standardObjects: standardCount,
      customObjects: customCount
    }
  };
};
