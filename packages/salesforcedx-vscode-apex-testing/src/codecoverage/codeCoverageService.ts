/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CodeCoverageResult } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import { FileType, Range, TextDocument, window } from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { IS_TEST_REG_EXP, RESULT_MAX_AGE_MS } from '../constants';
import { nls } from '../messages';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { sortByMtimeAscending } from '../utils/sortHelpers';

const SFDX_FOLDER = '.sfdx';
const IS_CLS_OR_TRIGGER = /(\.cls|\.trigger)$/;

/** No coverage discoverable for the project (no workspace, unreadable results dir, no result files, or all stale). */
/** @ExportTaggedError */
export class NoCoverageOnProjectError extends Schema.TaggedError<NoCoverageOnProjectError>()(
  'NoCoverageOnProjectError',
  {
    message: Schema.String
  }
) {}

/** Result files exist but none carry coverage keys. */
/** @ExportTaggedError */
export class StaleResultsError extends Schema.TaggedError<StaleResultsError>()('StaleResultsError', {
  message: Schema.String
}) {}

/** No coverage entry matches the current file. */
/** @ExportTaggedError */
export class NoCoverageForFileError extends Schema.TaggedError<NoCoverageForFileError>()('NoCoverageForFileError', {
  message: Schema.String
}) {}

/** A covered/uncovered line number falls outside the document's range (results out of sync with source). */
/** @ExportTaggedError */
export class OutOfSyncCoverageError extends Schema.TaggedError<OutOfSyncCoverageError>()('OutOfSyncCoverageError', {
  message: Schema.String
}) {}

const CoverageItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  totalLines: Schema.Number,
  lines: Schema.Record({ key: Schema.String, value: Schema.Number })
});
type CoverageItem = Schema.Schema.Type<typeof CoverageItem>;

type TestResultWithCoverage = {
  codecoverage?: CodeCoverageResult[];
  coverage?: { coverage: CodeCoverageResult[] };
};

export type CoverageRanges = { coveredLines: Range[]; uncoveredLines: Range[] };

const emptyRanges = (): CoverageRanges => ({ coveredLines: [], uncoveredLines: [] });

const noCoverage = (): NoCoverageOnProjectError =>
  new NoCoverageOnProjectError({ message: nls.localize('colorizer_no_code_coverage_on_project') });

/** Use document.uri.path for Web/Desktop compatibility (fsPath may be empty in Web for some schemes). */
const docPath = (document: TextDocument): string => document.uri.fsPath || document.uri.path;

const isApexMetadata = (pathOrUri: string): boolean => IS_CLS_OR_TRIGGER.test(pathOrUri);

/** Get Apex class/trigger name from document URI (no Node path APIs). */
const getApexMemberName = (document: TextDocument): string => {
  const pathStr = docPath(document);
  if (!isApexMetadata(pathStr)) {
    return '';
  }
  // isApexMetadata guarantees a .cls/.trigger suffix here, so the replace always matches.
  return Utils.basename(document.uri).replace(IS_CLS_OR_TRIGGER, '');
};

/** CoverageItem carries a per-line map; CodeCoverageResult carries covered/uncovered arrays. */
const isCodeCoverageItem = Schema.is(CoverageItem);

const getLineRange = Effect.fn('CodeCoverageService.getLineRange')(function* (document: TextDocument, lineNumber: number) {
  return yield* Effect.try({
    try: () => {
      const adjustedLineNumber = lineNumber - 1;
      const firstLine = document.lineAt(adjustedLineNumber);
      return new Range(
        adjustedLineNumber,
        firstLine.range.start.character,
        adjustedLineNumber,
        firstLine.range.end.character
      );
    },
    catch: () => new OutOfSyncCoverageError({ message: nls.localize('colorizer_out_of_sync_code_coverage_data') })
  });
});

/** Stat one result file; Some(name, mtime) if within the max age, None if stale. */
const statRecent = Effect.fn('CodeCoverageService.statRecent')(function* (
  apexTestResultsUri: URI,
  now: number,
  name: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const uri = Utils.joinPath(apexTestResultsUri, name);
  const stat = yield* api.services.FsService.stat(uri);
  return now - stat.mtime <= RESULT_MAX_AGE_MS ? Option.some({ name, mtime: stat.mtime }) : Option.none();
});

/** Read+parse one result file, returning its coverage items (empty if the file carries none). */
const readResult = Effect.fn('CodeCoverageService.readResult')(function* (apexTestResultsUri: URI, name: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const uri = Utils.joinPath(apexTestResultsUri, name);
  const content = yield* api.services.FsService.readFile(uri);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test result shape from apex-node
  const testResult = JSON.parse(content) as TestResultWithCoverage;
  return testResult.codecoverage ?? testResult.coverage?.coverage ?? [];
});

/**
 * CodeCoverageService — owns coverage Ref state and the coverage-data pipeline.
 * SettingsService and ChannelService are reached ambiently (prebuiltServicesDependencies) via
 * api.services; they are NOT declared as hard Default dependencies (that would double-provision
 * and conflict at runtime).
 */
export class CodeCoverageService extends Effect.Service<CodeCoverageService>()('CodeCoverageService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const coveredLines = yield* Ref.make<Range[]>([]);
    const uncoveredLines = yield* Ref.make<Range[]>([]);

    const getCoverageData = Effect.fn('CodeCoverageService.getCoverageData')(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const settings = yield* api.services.SettingsService;

      // no workspace folder open, or no default org / cannot resolve results folder
      const apexTestResultsUri = yield* getTestResultsFolder().pipe(
        Effect.catchTags({ NoDefaultOrgError: noCoverage, NoWorkspaceOpenError: noCoverage })
      );

      // readDirectoryWithTypes failed (results dir missing/unreadable)
      const entries = yield* api.services.FsService.readDirectoryWithTypes(apexTestResultsUri).pipe(
        Effect.catchAll(() => noCoverage())
      );

      const resultNames = entries
        .filter(({ type }) => type === FileType.File)
        .map(({ uri }) => Utils.basename(uri))
        .filter(
          name =>
            name.startsWith('test-result') && name.endsWith('.json') && !name.endsWith('-codecoverage.json')
        );

      if (resultNames.length === 0) {
        // no test-result files in the directory
        return yield* noCoverage();
      }

      const now = Date.now();
      const recentEntries = (yield* Effect.forEach(
        resultNames,
        // skip files we can't stat (stat order does not matter; sort happens after)
        name =>
          statRecent(apexTestResultsUri, now, name).pipe(
            Effect.catchAll(() => Effect.succeed(Option.none<{ name: string; mtime: number }>()))
          ),
        { concurrency: 'unbounded' }
      )).flatMap(Option.toArray);

      if (recentEntries.length === 0) {
        // all result files are older than RESULT_MAX_AGE_MS
        return yield* noCoverage();
      }

      // Sort oldest-first by mtime (see sortByMtimeAscending): last-write-wins aggregation
      // and the .at(-1) fallback below both depend on chronological order.
      const sortedEntries = sortByMtimeAscending(recentEntries);

      // When restore-previous-results is disabled, only use the most recent file
      const restorePrevious =
        (yield* settings.getValue<boolean>('salesforcedx-vscode-apex-testing', 'restore-previous-results', true)) ??
        true;
      const filesToRead = restorePrevious ? sortedEntries.map(e => e.name) : [sortedEntries.at(-1)!.name];

      // concurrency: 1 (sequential) is required — last-write-wins aggregation depends on chronological
      // (sortByMtimeAscending) order; unbounded concurrency would race the per-file results.
      const perFileItems = yield* Effect.forEach(
        filesToRead,
        // skip files we can't read or parse
        name => readResult(apexTestResultsUri, name).pipe(Effect.catchAll(() => Effect.succeed([]))),
        { concurrency: 1 }
      );

      // last-write-wins: later (newer) files overwrite earlier entries for the same class name.
      const coverageByName = new Map<string, CoverageItem | CodeCoverageResult>(
        perFileItems.flat().map(item => [item.name, item] as const)
      );

      if (coverageByName.size === 0) {
        return yield* new StaleResultsError({
          message: nls.localize('colorizer_no_code_coverage_in_recent_results')
        });
      }

      return [...coverageByName.values()];
    });

    const computeRanges = Effect.fn('CodeCoverageService.computeRanges')(function* (document: TextDocument) {
      if (
        docPath(document).includes(SFDX_FOLDER) ||
        !isApexMetadata(docPath(document)) ||
        IS_TEST_REG_EXP.test(document.getText())
      ) {
        return emptyRanges();
      }

      const codeCovArray = yield* getCoverageData();
      const apexMemberName = getApexMemberName(document);
      const codeCovItem = codeCovArray.find(covItem => covItem.name === apexMemberName);

      if (!codeCovItem) {
        return yield* new NoCoverageForFileError({
          message: nls.localize('colorizer_no_code_coverage_current_file', docPath(document))
        });
      }

      if (isCodeCoverageItem(codeCovItem)) {
        const lines = Object.entries(codeCovItem.lines);
        return {
          coveredLines: yield* Effect.forEach(
            lines.filter(([, value]) => value === 1),
            ([key]) => getLineRange(document, Number(key))
          ),
          uncoveredLines: yield* Effect.forEach(
            lines.filter(([, value]) => value !== 1),
            ([key]) => getLineRange(document, Number(key))
          )
        };
      }

      return {
        coveredLines: yield* Effect.forEach(codeCovItem.coveredLines, cov => getLineRange(document, Number(cov))),
        uncoveredLines: yield* Effect.forEach(codeCovItem.uncoveredLines, uncov =>
          getLineRange(document, Number(uncov))
        )
      };
    });

    /** Reset coverage Refs to empty. */
    const clear = Effect.fn('CodeCoverageService.clear')(function* () {
      yield* Ref.set(coveredLines, []);
      yield* Ref.set(uncoveredLines, []);
      return emptyRanges();
    });

    /** Read the current coverage ranges from the Refs. */
    const getRanges = Effect.fn('CodeCoverageService.getRanges')(function* () {
      return { coveredLines: yield* Ref.get(coveredLines), uncoveredLines: yield* Ref.get(uncoveredLines) };
    });

    /** Log coverage error to channel (if warnings disabled) or show as warning message. */
    const handleCoverageException = Effect.fn('CodeCoverageService.handleCoverageException')(function* (
      e: NoCoverageOnProjectError | StaleResultsError | NoCoverageForFileError | OutOfSyncCoverageError
    ) {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const settings = yield* api.services.SettingsService;
      const disableWarning =
        (yield* settings.getValue<boolean>(
          'salesforcedx-vscode-apex-testing',
          'disable-warnings-for-missing-coverage',
          false
        )) ?? false;
      if (disableWarning) {
        const svc = yield* api.services.ChannelService;
        yield* svc.appendToChannel(e.message);
      } else {
        yield* Effect.sync(() => {
          void window.showWarningMessage(nls.localize('colorizer_coverage_apply_failed_message', e.message));
        });
      }
    });

    /** Compute coverage for the editor's document, store it in Refs, and return the ranges. */
    const applyForEditor = Effect.fn('CodeCoverageService.applyForEditor')(function* (document: TextDocument) {
      const ranges = yield* computeRanges(document);
      yield* Ref.set(coveredLines, ranges.coveredLines);
      yield* Ref.set(uncoveredLines, ranges.uncoveredLines);
      return ranges;
    });

    /**
     * Apply coverage for the editor, handling every coverage failure and returning the ranges to decorate.
     * On failure the Refs are reset to empty so the editor clears stale decorations instead of redrawing
     * the previous file's ranges.
     */
    const applyForEditorHandled = Effect.fn('CodeCoverageService.applyForEditorHandled')(function* (
      document: TextDocument
    ) {
      return yield* applyForEditor(document).pipe(
        // Enumerate tags (not catchAll) so a new failure type forces a compile decision.
        Effect.catchTags({
          NoCoverageOnProjectError: e => handleCoverageException(e).pipe(Effect.zipRight(clear())),
          StaleResultsError: e => handleCoverageException(e).pipe(Effect.zipRight(clear())),
          NoCoverageForFileError: e => handleCoverageException(e).pipe(Effect.zipRight(clear())),
          OutOfSyncCoverageError: e => handleCoverageException(e).pipe(Effect.zipRight(clear()))
        })
      );
    });

    return { applyForEditor, applyForEditorHandled, clear, getRanges, handleCoverageException };
  })
}) {}
