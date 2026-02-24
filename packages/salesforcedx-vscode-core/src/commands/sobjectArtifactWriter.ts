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
  type SObjectRefreshResult,
  type SObjectShortDescription,
  type SObjectsStandardAndCustom
} from '@salesforce/salesforcedx-sobjects-faux-generator';
import { type CancellationToken } from '@salesforce/salesforcedx-utils';
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import { nls } from '../messages';

const APEX_CLASS_EXTENSION = '.cls';
const TYPESCRIPT_TYPE_EXT = '.d.ts';
const TYPINGS_PATH = ['typings', 'lwc', 'sobjects'] as const;
const WRITE_CONCURRENCY = 50;

type SobjectArtifactWriterArgs = {
  emitter: EventEmitter;
  cancellationToken: CancellationToken;
  sobjects: SObjectsStandardAndCustom;
  sobjectNames: SObjectShortDescription[];
};

/**
 * Writes all SObject artifacts (Apex faux classes, TypeScript typings, SOQL metadata)
 * using FsService (web-compatible vscode.workspace.fs) with bounded concurrency.
 */
export const writeSobjectArtifacts = async (args: SobjectArtifactWriterArgs): Promise<SObjectRefreshResult> => {
  const { emitter, cancellationToken, sobjects, sobjectNames } = args;
  try {
    if (!cancellationToken.isCancellationRequested) {
      for (const [category, objects] of Object.entries(sobjects)) {
        if (objects.length > 0) {
          emitter.emit(
            STDOUT_EVENT,
            nls.localize('processed_sobjects_length_text', objects.length, capitalize(category))
          );
        }
      }
    }

    if (!cancellationToken.isCancellationRequested) {
      await Effect.runPromise(writeArtifactsEffect(sobjects, sobjectNames));
    }

    emitter.emit(EXIT_EVENT, cancellationToken.isCancellationRequested ? FAILURE_CODE : SUCCESS_CODE);
    return {
      data: {
        cancelled: cancellationToken.isCancellationRequested,
        standardObjects: sobjects.standard.length,
        customObjects: sobjects.custom.length
      }
    };
  } catch (error) {
    emitter.emit(STDERR_EVENT, `${error instanceof Error ? error.message : String(error)}\n`);
    emitter.emit(ERROR_EVENT, error);
    emitter.emit(EXIT_EVENT, FAILURE_CODE);
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
    return Promise.reject({
      error: error instanceof Error ? error : new Error(String(error)),
      data: { cancelled: false }
    });
  }
};

const writeArtifactsEffect = (sobjects: SObjectsStandardAndCustom, sobjectNames: SObjectShortDescription[]) =>
  Effect.gen(function* () {
    const api = yield* getServicesApi;
    const fsLayer = api.services.FsService.Default;
    const fs = api.services.FsService;

    const fauxStandardDir = path.join(projectPaths.toolsFolder(), SOBJECTS_DIR, 'standardObjects');
    const fauxCustomDir = path.join(projectPaths.toolsFolder(), SOBJECTS_DIR, 'customObjects');
    const typingsDir = path.join(projectPaths.stateFolder(), ...TYPINGS_PATH);
    const soqlMetaDir = path.join(projectPaths.toolsFolder(), SOQLMETADATA_DIR);
    const soqlStandardDir = path.join(soqlMetaDir, 'standardObjects');
    const soqlCustomDir = path.join(soqlMetaDir, 'customObjects');

    // Reset all output dirs in parallel before writing
    yield* Effect.all(
      [
        fs.safeDelete(fauxStandardDir, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(fauxStandardDir))),
        fs.safeDelete(fauxCustomDir, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(fauxCustomDir))),
        fs.safeDelete(typingsDir, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(typingsDir))),
        fs.safeDelete(soqlStandardDir, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(soqlStandardDir))),
        fs.safeDelete(soqlCustomDir, { recursive: true }).pipe(Effect.flatMap(() => fs.createDirectory(soqlCustomDir)))
      ],
      { concurrency: 'unbounded' }
    ).pipe(Effect.provide(fsLayer));

    // Pair every SObject with its target dirs
    const objectsWithDirs = [
      ...sobjects.standard.map(o => ({ sobject: o, fauxDir: fauxStandardDir, soqlDir: soqlStandardDir })),
      ...sobjects.custom.map(o => ({ sobject: o, fauxDir: fauxCustomDir, soqlDir: soqlCustomDir }))
    ];

    // Stream all per-object writes with bounded concurrency
    yield* Stream.fromIterable(objectsWithDirs).pipe(
      Stream.mapEffect(
        ({ sobject, fauxDir, soqlDir }) => {
          const definition = generateSObjectDefinition(sobject);
          return Effect.all(
            [
              fs.writeFile(path.join(fauxDir, `${sobject.name}${APEX_CLASS_EXTENSION}`), generateFauxClassText(definition)),
              fs.writeFile(path.join(typingsDir, `${sobject.name}${TYPESCRIPT_TYPE_EXT}`), generateTypeText(definition)),
              fs.writeFile(path.join(soqlDir, `${sobject.name}.json`), JSON.stringify(sobject, null, 2))
            ],
            { concurrency: 'unbounded' }
          );
        },
        { concurrency: WRITE_CONCURRENCY }
      ),
      Stream.runDrain,
      Effect.provide(fsLayer)
    );

    // Write typeNames.json
    yield* fs.writeFile(path.join(soqlMetaDir, 'typeNames.json'), JSON.stringify(sobjectNames, null, 2)).pipe(
      Effect.provide(fsLayer)
    );
  });

const capitalize = (s: string): string => (s.length === 0 ? s : `${s[0].toUpperCase()}${s.slice(1)}`);
