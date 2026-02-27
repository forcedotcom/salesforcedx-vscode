/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SObjectShortDescription, SObjectsStandardAndCustom } from '../sobjects/describeTypes';
import type { SObjectCategory, SObjectRefreshSource } from '../sobjects/types/general';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import type { SObject } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
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
 * Streaming write effect for the normal refresh path.
 *
 * Phase 1: listSObjects + reset all 5 output dirs (parallel)
 * Phase 2: write typeNames.json (needs listSObjects result)
 * Phase 3: describeCustomObjects stream → toMinimal → 3 file writes per SObject
 */
const streamAndWriteSobjectArtifactsEffect = Effect.fn('streamAndWriteSobjectArtifacts')(function* (
  category: SObjectCategory,
  source: Exclude<SObjectRefreshSource, 'startupmin'>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fs = yield* api.services.FsService;
  const project = yield* api.services.ProjectService;
  const tx = yield* api.services.TransmogrifierService;

  const [fauxStandard, fauxCustom, typings, soqlMeta, soqlStandard, soqlCustom] = yield* Effect.all(
    [
      project.getFauxStandardObjectsPath(),
      project.getFauxCustomObjectsPath(),
      project.getTypingsPath(),
      project.getSoqlMetadataPath(),
      project.getSoqlStandardObjectsPath(),
      project.getSoqlCustomObjectsPath()
    ],
    { concurrency: 'unbounded' }
  );

  // Phase 1: listSObjects and dir resets run in parallel — saves ~0.5s
  const [allSObjects] = yield* Effect.all(
    [
      (yield* api.services.MetadataDescribeService).listSObjects(),
      fs.safeDelete(fauxStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(fauxStandard))),
      fs.safeDelete(fauxCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(fauxCustom))),
      fs.safeDelete(typings, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(typings))),
      fs.safeDelete(soqlStandard, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(soqlStandard))),
      fs.safeDelete(soqlCustom, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(soqlCustom)))
    ],
    { concurrency: 'unbounded' }
  );
  const sobjectNames = allSObjects.filter(sobjectTypeFilter(category, source));

  // Phase 2: typeNames.json — sobjectNames known, dirs ready
  yield* fs.writeFile(Utils.joinPath(soqlMeta, 'typeNames.json'), JSON.stringify(sobjectNames, null, 2));

  // Phase 3: describe stream + file writes overlapped.
  const standardRef = yield* Ref.make(0);
  const customRef = yield* Ref.make(0);

  yield* (yield* api.services.MetadataDescribeService.describeCustomObjects(sobjectNames.map(s => s.name))).pipe(
    Stream.mapEffect(tx.toMinimalSObject),
    Stream.tap(sobject => Effect.log(`saw desribe for sobject ${sobject.name}`)),
    Stream.runForEach(sobject =>
      Effect.gen(function* () {
        const isCustom = sobject.custom;
        const definition = generateSObjectDefinition(sobject);
        return yield* Effect.all(
          [
            fs.writeFile(
              Utils.joinPath(isCustom ? fauxCustom : fauxStandard, `${sobject.name}${APEX_CLASS_EXTENSION}`),
              generateFauxClassText(definition)
            ),
            fs.writeFile(
              Utils.joinPath(typings, `${sobject.name}${TYPESCRIPT_TYPE_EXT}`),
              generateTypeText(definition)
            ),
            fs.writeFile(
              Utils.joinPath(isCustom ? soqlCustom : soqlStandard, `${sobject.name}.json`),
              JSON.stringify(sobject, null, 2)
            ),
            Ref.update(isCustom ? customRef : standardRef, n => n + 1)
          ],
          { concurrency: 'unbounded' }
        );
      })
    )
  );

  yield* Effect.annotateCurrentSpan({
    standardObjects: yield* Ref.get(standardRef),
    customObjects: yield* Ref.get(customRef)
  });
  return [yield* Ref.get(standardRef), yield* Ref.get(customRef)] as const;
});

/**
 * Core write effect for the startupmin path.
 * Accepts a pre-built stream of minimal SObjects — no describe call needed.
 */
const writeSobjectArtifactsEffect = Effect.fn('writeSobjectArtifacts')(function* (
  sobjectStream: Stream.Stream<SObject>,
  sobjectNames: SObjectShortDescription[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fs = yield* api.services.FsService;
  const project = yield* api.services.ProjectService;

  const [fauxStandard, fauxCustom, typings, soqlMeta, soqlStandard, soqlCustom] = yield* Effect.all(
    [
      project.getFauxStandardObjectsPath(),
      project.getFauxCustomObjectsPath(),
      project.getTypingsPath(),
      project.getSoqlMetadataPath(),
      project.getSoqlStandardObjectsPath(),
      project.getSoqlCustomObjectsPath()
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
      fs.writeFile(Utils.joinPath(soqlMeta, 'typeNames.json'), JSON.stringify(sobjectNames, null, 2))
    ],
    { concurrency: 'unbounded' }
  );

  const standardRef = yield* Ref.make(0);
  const customRef = yield* Ref.make(0);

  yield* sobjectStream.pipe(
    Stream.mapEffect(
      sobject => {
        const isCustom = sobject.custom;
        const definition = generateSObjectDefinition(sobject);
        return Effect.all(
          [
            fs.writeFile(
              Utils.joinPath(isCustom ? fauxCustom : fauxStandard, `${sobject.name}${APEX_CLASS_EXTENSION}`),
              generateFauxClassText(definition)
            ),
            fs.writeFile(
              Utils.joinPath(typings, `${sobject.name}${TYPESCRIPT_TYPE_EXT}`),
              generateTypeText(definition)
            ),
            fs.writeFile(
              Utils.joinPath(isCustom ? soqlCustom : soqlStandard, `${sobject.name}.json`),
              JSON.stringify(sobject, null, 2)
            ),
            Ref.update(isCustom ? customRef : standardRef, n => n + 1)
          ],
          { concurrency: 'unbounded' }
        );
      },
      { concurrency: WRITE_CONCURRENCY }
    ),
    Stream.runDrain
  );

  return [yield* Ref.get(standardRef), yield* Ref.get(customRef)] as const;
});

type StreamWriterArgs = {
  cancellationToken: vscode.CancellationToken;
  category: SObjectCategory;
  source: Exclude<SObjectRefreshSource, 'startupmin'>;
};

/**
 * Streaming path: listSObjects, dir resets, describe + writes all in one shared Effect scope.
 */
export const streamAndWriteSobjectArtifacts = (args: StreamWriterArgs) =>
  args.cancellationToken.isCancellationRequested
    ? Effect.succeed({ data: { cancelled: true, standardObjects: 0, customObjects: 0 } })
    : streamAndWriteSobjectArtifactsEffect(args.category, args.source).pipe(
        Effect.map(([standardCount, customCount]) => ({
          data: {
            cancelled: args.cancellationToken.isCancellationRequested,
            standardObjects: standardCount,
            customObjects: customCount
          }
        }))
      );

type StaticWriterArgs = {
  cancellationToken: vscode.CancellationToken;
  sobjects: SObjectsStandardAndCustom;
  sobjectNames: SObjectShortDescription[];
};

/**
 * Static path: used by startupmin which supplies pre-fetched bundled SObjects.
 */
export const writeSobjectArtifacts = (args: StaticWriterArgs) =>
  args.cancellationToken.isCancellationRequested
    ? Effect.succeed({ data: { cancelled: true, standardObjects: 0, customObjects: 0 } })
    : writeSobjectArtifactsEffect(
        Stream.fromIterable<SObject>([...args.sobjects.standard, ...args.sobjects.custom]),
        args.sobjectNames
      ).pipe(
        Effect.map(([standardCount, customCount]) => ({
          data: {
            cancelled: args.cancellationToken.isCancellationRequested,
            standardObjects: standardCount,
            customObjects: customCount
          }
        }))
      );
