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
import { FileType, Range, TextDocument, window, workspace } from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { IS_TEST_REG_EXP, RESULT_MAX_AGE_MS } from '../constants';
import { nls } from '../messages';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { sortByMtimeAscending } from '../utils/sortHelpers';

const SFDX_FOLDER = '.sfdx';
const IS_CLS_OR_TRIGGER = /(\.cls|\.trigger)$/;

/** No coverage discoverable for the project (no workspace, unreadable results dir, no result files, or all stale). */
export class NoCoverageOnProjectError extends Schema.TaggedError<NoCoverageOnProjectError>()(
  'NoCoverageOnProjectError',
  {
    message: Schema.String
  }
) {}

/** Result files exist but none carry coverage keys. */
export class StaleResultsError extends Schema.TaggedError<StaleResultsError>()('StaleResultsError', {
  message: Schema.String
}) {}

/** No coverage entry matches the current file. */
export class NoCoverageForFileError extends Schema.TaggedError<NoCoverageForFileError>()('NoCoverageForFileError', {
  message: Schema.String,
  filePath: Schema.String
}) {}

/** A covered/uncovered line number falls outside the document's range (results out of sync with source). */
export class OutOfSyncCoverageError extends Schema.TaggedError<OutOfSyncCoverageError>()('OutOfSyncCoverageError', {
  message: Schema.String
}) {}

type CoverageItem = {
  id: string;
  name: string;
  totalLines: number;
  lines: { [key: string]: number };
};

type TestResultWithCoverage = {
  codecoverage?: CodeCoverageResult[];
  coverage?: { coverage: CodeCoverageResult[] };
};

export type CoverageRanges = { coveredLines: Range[]; uncoveredLines: Range[] };

const emptyRanges = (): CoverageRanges => ({ coveredLines: [], uncoveredLines: [] });

/** Use document.uri.path for Web/Desktop compatibility (fsPath may be empty in Web for some schemes). */
const docPath = (document: TextDocument): string => document.uri.fsPath || document.uri.path;

const isApexMetadata = (pathOrUri: string): boolean => IS_CLS_OR_TRIGGER.test(pathOrUri);

/** Get Apex class/trigger name from document URI (no Node path APIs). */
const getApexMemberName = (document: TextDocument): string => {
  const pathStr = docPath(document);
  if (!isApexMetadata(pathStr)) {
    return '';
  }
  const base = Utils.basename(document.uri);
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
  return ext ? base.slice(0, -ext.length) : base;
};

const isCodeCoverageItem = (item: CoverageItem | CodeCoverageResult): item is CoverageItem => 'lines' in item;

const getLineRange = (document: TextDocument, lineNumber: number): Effect.Effect<Range, OutOfSyncCoverageError> =>
  Effect.try({
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

const readFileUri = (uri: URI): Effect.Effect<string, unknown> =>
  Effect.tryPromise(async () => {
    const data = await workspace.fs.readFile(uri);
    return new TextDecoder().decode(data);
  });

/**
 * CodeCoverageService — owns coverage Ref state and the coverage-data pipeline.
 * SettingsService is reached ambiently (prebuiltServicesDependencies); it is NOT declared as a
 * hard Default dependency (that would double-provision and conflict at runtime).
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

      if (!workspace.workspaceFolders?.[0]?.uri) {
        // no workspace folder open
        return yield* new NoCoverageOnProjectError({
          message: nls.localize('colorizer_no_code_coverage_on_project')
        });
      }

      const apexTestResultsUri = yield* Effect.promise(() => getTestResultsFolder());

      const entries = yield* Effect.tryPromise({
        try: () => workspace.fs.readDirectory(apexTestResultsUri),
        // readDirectory failed (results dir missing/unreadable)
        catch: () => new NoCoverageOnProjectError({ message: nls.localize('colorizer_no_code_coverage_on_project') })
      });

      const resultNames = entries
        .filter(
          ([name, type]) =>
            type === FileType.File &&
            name.startsWith('test-result') &&
            name.endsWith('.json') &&
            !name.endsWith('-codecoverage.json')
        )
        .map(([name]) => name);

      if (resultNames.length === 0) {
        // no test-result files in the directory
        return yield* new NoCoverageOnProjectError({
          message: nls.localize('colorizer_no_code_coverage_on_project')
        });
      }

      const now = Date.now();
      const statRecent = Effect.fn('CodeCoverageService.statRecent')(function* (name: string) {
        const uri = Utils.joinPath(apexTestResultsUri, name);
        const stat = yield* Effect.tryPromise(() => workspace.fs.stat(uri));
        return now - stat.mtime <= RESULT_MAX_AGE_MS ? Option.some({ name, mtime: stat.mtime }) : Option.none();
      });

      const recentEntries = (yield* Effect.forEach(
        resultNames,
        // skip files we can't stat (stat order does not matter; sort happens after)
        name =>
          statRecent(name).pipe(Effect.catchAll(() => Effect.succeed(Option.none<{ name: string; mtime: number }>()))),
        { concurrency: 'unbounded' }
      )).flatMap(Option.toArray);

      if (recentEntries.length === 0) {
        // all result files are older than RESULT_MAX_AGE_MS
        return yield* new NoCoverageOnProjectError({
          message: nls.localize('colorizer_no_code_coverage_on_project')
        });
      }

      // Sort oldest-first by mtime (see sortByMtimeAscending): last-write-wins aggregation
      // and the .at(-1) fallback below both depend on chronological order.
      const sortedEntries = sortByMtimeAscending(recentEntries);

      // When restore-previous-results is disabled, only use the most recent file
      const restorePrevious =
        (yield* settings.getValue<boolean>('salesforcedx-vscode-apex-testing', 'restore-previous-results', true)) ??
        true;
      const filesToRead = restorePrevious ? sortedEntries.map(e => e.name) : [sortedEntries.at(-1)!.name];

      const coverageByName = new Map<string, CoverageItem | CodeCoverageResult>();

      const readResult = Effect.fn('CodeCoverageService.readResult')(function* (name: string) {
        const uri = Utils.joinPath(apexTestResultsUri, name);
        const content = yield* readFileUri(uri);
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test result shape from apex-node
        const testResult = JSON.parse(content) as TestResultWithCoverage;
        const items: (CoverageItem | CodeCoverageResult)[] | undefined =
          testResult.codecoverage ?? testResult.coverage?.coverage;
        items?.forEach(item => coverageByName.set(item.name, item));
      });

      // concurrency: 1 (sequential) is required — last-write-wins aggregation into coverageByName
      // depends on chronological (sortByMtimeAscending) order; unbounded concurrency would race the Map.set.
      yield* Effect.forEach(
        filesToRead,
        // skip files we can't read or parse
        name => readResult(name).pipe(Effect.catchAll(() => Effect.void)),
        { concurrency: 1 }
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
          message: nls.localize('colorizer_no_code_coverage_current_file', docPath(document)),
          filePath: docPath(document)
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

    /** Compute coverage for the editor's document, store it in Refs, and return the ranges. */
    const applyForEditor = Effect.fn('CodeCoverageService.applyForEditor')(function* (document: TextDocument) {
      const ranges = yield* computeRanges(document);
      yield* Ref.set(coveredLines, ranges.coveredLines);
      yield* Ref.set(uncoveredLines, ranges.uncoveredLines);
      return ranges;
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
        yield* Effect.tryPromise(() =>
          window.showWarningMessage(nls.localize('colorizer_coverage_apply_failed_message', e.message))
        );
      }
    });

    return { applyForEditor, clear, getRanges, handleCoverageException };
  })
}) {}
