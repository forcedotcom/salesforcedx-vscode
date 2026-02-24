/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getServicesApi } from '@salesforce/effect-ext-utils';
import {
  ERROR_EVENT,
  EXIT_EVENT,
  FAILURE_CODE,
  SOBJECTS_DIR,
  SOQLMETADATA_DIR,
  STDERR_EVENT,
  STDOUT_EVENT,
  SUCCESS_CODE,
  generateFauxClassText,
  generateSObjectDefinition,
  generateTypeText,
  sobjectTypeFilter,
  toMinimalSObject,
  type SObject,
  type SObjectCategory,
  type SObjectRefreshResult,
  type SObjectRefreshSource,
  type SObjectShortDescription,
  type SObjectsStandardAndCustom
} from '@salesforce/salesforcedx-sobjects-faux-generator';
import { type CancellationToken } from '@salesforce/salesforcedx-utils';
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import { nls } from '../messages';

const APEX_CLASS_EXTENSION = '.cls';
const TYPESCRIPT_TYPE_EXT = '.d.ts';
const TYPINGS_PATH = ['typings', 'lwc', 'sobjects'] as const;
const WRITE_CONCURRENCY = 50;

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

type Dirs = {
  fauxStandard: string;
  fauxCustom: string;
  typings: string;
  soqlMeta: string;
  soqlStandard: string;
  soqlCustom: string;
};

const buildDirs = (): Dirs => ({
  fauxStandard: path.join(projectPaths.toolsFolder(), SOBJECTS_DIR, 'standardObjects'),
  fauxCustom: path.join(projectPaths.toolsFolder(), SOBJECTS_DIR, 'customObjects'),
  typings: path.join(projectPaths.stateFolder(), ...TYPINGS_PATH),
  soqlMeta: path.join(projectPaths.toolsFolder(), SOQLMETADATA_DIR),
  soqlStandard: path.join(projectPaths.toolsFolder(), SOQLMETADATA_DIR, 'standardObjects'),
  soqlCustom: path.join(projectPaths.toolsFolder(), SOQLMETADATA_DIR, 'customObjects')
});

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
    const fs = api.services.FsService;
    const dirs = buildDirs();

    return yield* Effect.gen(function* () {
      // Phase 1: listSObjects and dir resets run in parallel — saves ~0.5s
      const [allSObjects] = yield* Effect.all(
        [
          api.services.MetadataDescribeService.listSObjects(),
          Effect.all(
            [
              fs.safeDelete(dirs.fauxStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.fauxStandard))),
              fs.safeDelete(dirs.fauxCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.fauxCustom))),
              fs.safeDelete(dirs.typings, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.typings))),
              fs.safeDelete(dirs.soqlStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.soqlStandard))),
              fs.safeDelete(dirs.soqlCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.soqlCustom)))
            ],
            { concurrency: 'unbounded' }
          )
        ],
        { concurrency: 'unbounded' }
      );
      const sobjectNames = allSObjects.filter(sobjectTypeFilter(category, source));

      // Phase 2: typeNames.json — sobjectNames known, dirs ready
      yield* fs.writeFile(path.join(dirs.soqlMeta, 'typeNames.json'), JSON.stringify(sobjectNames, null, 2));

      // Phase 3: describe stream + file writes overlapped.
      // listSObjects and describeCustomObjects share the same MetadataDescribeService
      // instance (one connection) because both run inside the same Effect.provide below.
      const standardRef = yield* Ref.make(0);
      const customRef = yield* Ref.make(0);

      const describeStream = Stream.flatten(
        api.services.MetadataDescribeService.describeCustomObjects(sobjectNames.map(s => s.name))
      );

      yield* Stream.runDrain(
        typedMapEffect(
          describeStream,
          raw => {
            const sobject = toMinimalSObject(raw);
            const isCustom = sobject.custom;
            const fauxDir = isCustom ? dirs.fauxCustom : dirs.fauxStandard;
            const soqlDir = isCustom ? dirs.soqlCustom : dirs.soqlStandard;
            const definition = generateSObjectDefinition(sobject);
            const countRef = isCustom ? customRef : standardRef;
            return Effect.all(
              [
                fs.writeFile(path.join(fauxDir, `${sobject.name}${APEX_CLASS_EXTENSION}`), generateFauxClassText(definition)),
                fs.writeFile(path.join(dirs.typings, `${sobject.name}${TYPESCRIPT_TYPE_EXT}`), generateTypeText(definition)),
                fs.writeFile(path.join(soqlDir, `${sobject.name}.json`), JSON.stringify(sobject, null, 2)),
                Ref.update(countRef, n => n + 1)
              ],
              { concurrency: 'unbounded' }
            );
          },
          { concurrency: WRITE_CONCURRENCY }
        )
      );

      return [yield* Ref.get(standardRef), yield* Ref.get(customRef)] as const;
    }).pipe(
      // Single merged layer: both services are built once and shared across
      // listSObjects, dir resets, describeCustomObjects, and all file writes.
      Effect.provide(Layer.merge(fsLayer, mdLayer))
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
    const fs = api.services.FsService;
    const dirs = buildDirs();

    return yield* Effect.gen(function* () {
      yield* Effect.all(
        [
          fs.safeDelete(dirs.fauxStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.fauxStandard))),
          fs.safeDelete(dirs.fauxCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.fauxCustom))),
          fs.safeDelete(dirs.typings, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.typings))),
          fs.safeDelete(dirs.soqlStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.soqlStandard))),
          fs.safeDelete(dirs.soqlCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(dirs.soqlCustom))),
          fs.writeFile(path.join(dirs.soqlMeta, 'typeNames.json'), JSON.stringify(sobjectNames, null, 2))
        ],
        { concurrency: 'unbounded' }
      );

      const standardRef = yield* Ref.make(0);
      const customRef = yield* Ref.make(0);

      yield* sobjectStream.pipe(
        Stream.mapEffect(
          sobject => {
            const isCustom = sobject.custom;
            const fauxDir = isCustom ? dirs.fauxCustom : dirs.fauxStandard;
            const soqlDir = isCustom ? dirs.soqlCustom : dirs.soqlStandard;
            const definition = generateSObjectDefinition(sobject);
            const countRef = isCustom ? customRef : standardRef;
            return Effect.all(
              [
                fs.writeFile(path.join(fauxDir, `${sobject.name}${APEX_CLASS_EXTENSION}`), generateFauxClassText(definition)),
                fs.writeFile(path.join(dirs.typings, `${sobject.name}${TYPESCRIPT_TYPE_EXT}`), generateTypeText(definition)),
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
    }).pipe(Effect.provide(fsLayer));
  });

const emitResults = (
  emitter: EventEmitter,
  cancellationToken: CancellationToken,
  standardCount: number,
  customCount: number
): SObjectRefreshResult => {
  if (standardCount > 0) {
    emitter.emit(STDOUT_EVENT, nls.localize('processed_sobjects_length_text', standardCount, 'Standard'));
  }
  if (customCount > 0) {
    emitter.emit(STDOUT_EVENT, nls.localize('processed_sobjects_length_text', customCount, 'Custom'));
  }
  emitter.emit(EXIT_EVENT, cancellationToken.isCancellationRequested ? FAILURE_CODE : SUCCESS_CODE);
  return {
    data: {
      cancelled: cancellationToken.isCancellationRequested,
      standardObjects: standardCount,
      customObjects: customCount
    }
  };
};

const handleError = (emitter: EventEmitter, error: unknown): never => {
  emitter.emit(STDERR_EVENT, `${error instanceof Error ? error.message : String(error)}\n`);
  emitter.emit(ERROR_EVENT, error);
  emitter.emit(EXIT_EVENT, FAILURE_CODE);
  throw error instanceof Error ? error : new Error(String(error));
};

type StreamWriterArgs = {
  emitter: EventEmitter;
  cancellationToken: CancellationToken;
  category: SObjectCategory;
  source: Exclude<SObjectRefreshSource, 'startupmin'>;
};

/**
 * Streaming path: listSObjects, dir resets, describe + writes all in one shared Effect scope.
 * One connection, one layer build, maximum I/O overlap.
 */
export const streamAndWriteSobjectArtifacts = async (args: StreamWriterArgs): Promise<SObjectRefreshResult> => {
  const { emitter, cancellationToken, category, source } = args;
  try {
    if (cancellationToken.isCancellationRequested) {
      return emitResults(emitter, cancellationToken, 0, 0);
    }
    const [standardCount, customCount] = await Effect.runPromise(runStreamWriteEffect(category, source));
    return emitResults(emitter, cancellationToken, standardCount, customCount);
  } catch (error) {
    return handleError(emitter, error);
  }
};

type StaticWriterArgs = {
  emitter: EventEmitter;
  cancellationToken: CancellationToken;
  sobjects: SObjectsStandardAndCustom;
  sobjectNames: SObjectShortDescription[];
};

/**
 * Static path: used by startupmin which supplies pre-fetched bundled SObjects.
 */
export const writeSobjectArtifacts = async (args: StaticWriterArgs): Promise<SObjectRefreshResult> => {
  const { emitter, cancellationToken, sobjects, sobjectNames } = args;
  try {
    if (cancellationToken.isCancellationRequested) {
      return emitResults(emitter, cancellationToken, 0, 0);
    }
    const sobjectStream = Stream.fromIterable<SObject>([...sobjects.standard, ...sobjects.custom]);
    const [standardCount, customCount] = await Effect.runPromise(runWriteEffect(sobjectStream, sobjectNames));
    return emitResults(emitter, cancellationToken, standardCount, customCount);
  } catch (error) {
    return handleError(emitter, error);
  }
};
