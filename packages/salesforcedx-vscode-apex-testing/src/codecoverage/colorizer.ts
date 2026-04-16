/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CodeCoverageResult } from '@salesforce/apex-node';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { Range, TextDocument, TextEditor, window, workspace } from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { IS_TEST_REG_EXP } from '../constants';
import { nls } from '../messages';
import { getApexTestingRuntime } from '../services/extensionProvider';
import { coveredLinesDecorationType, uncoveredLinesDecorationType } from './decorations';
import { StatusBarToggle } from './statusBarToggle';

const SFDX_FOLDER = '.sfdx';
const TOOLS = 'tools';
const TEST_RESULTS = 'testresults';
const APEX = 'apex';
const IS_CLS_OR_TRIGGER = /(\.cls|\.trigger)$/;

/** Path segment for apex test results (works in Desktop and Web). */
const getApexTestResultsUri = (): URI => {
  const folder = workspace.workspaceFolders?.[0]?.uri;
  if (!folder) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_project'));
  }
  return Utils.joinPath(folder, SFDX_FOLDER, TOOLS, TEST_RESULTS, APEX);
};

const getLineRange = (document: TextDocument, lineNumber: number): Range => {
  const adjustedLineNumber = lineNumber - 1;
  try {
    const firstLine = document.lineAt(adjustedLineNumber);
    return new Range(
      adjustedLineNumber,
      firstLine.range.start.character,
      adjustedLineNumber,
      firstLine.range.end.character
    );
  } catch {
    throw new Error(nls.localize('colorizer_out_of_sync_code_coverage_data'));
  }
};

type CoverageItem = {
  id: string;
  name: string;
  totalLines: number;
  lines: { [key: string]: number };
};

const fileExists = async (uri: URI): Promise<boolean> => {
  try {
    await workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
};

const readFileUri = async (uri: URI): Promise<string> => {
  const data = await workspace.fs.readFile(uri);
  return new TextDecoder().decode(data);
};

const getTestRunId = async (): Promise<string> => {
  const apexTestResultsUri = getApexTestResultsUri();
  const testRunIdUri = Utils.joinPath(apexTestResultsUri, 'test-run-id.txt');
  if (!(await fileExists(testRunIdUri))) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_project'));
  }
  return (await readFileUri(testRunIdUri)).trim();
};

const getCoverageData = async (): Promise<CoverageItem[] | CodeCoverageResult[]> => {
  const testRunId = await getTestRunId();
  const apexTestResultsUri = getApexTestResultsUri();
  const testResultUri = Utils.joinPath(apexTestResultsUri, `test-result-${testRunId}.json`);

  if (!(await fileExists(testResultUri))) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_test_results', testRunId));
  }
  const testResultOutput = await readFileUri(testResultUri);
  type TestResultWithCoverage = {
    codecoverage?: CodeCoverageResult[];
    coverage?: { coverage: CodeCoverageResult[] };
  };
  // JSON.parse returns any; shape is validated before use
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test result shape from apex-node
  const testResult = JSON.parse(testResultOutput) as TestResultWithCoverage;
  if (testResult.coverage === undefined && testResult.codecoverage === undefined) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_test_results', testRunId));
  }
  if (testResult.codecoverage !== undefined) {
    return testResult.codecoverage;
  }
  if (testResult.coverage !== undefined) {
    return testResult.coverage.coverage;
  }
  throw new Error(nls.localize('colorizer_no_code_coverage_on_test_results', testRunId));
};

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

/** Log coverage error to channel (if warnings disabled) or show as warning message */
const handleCoverageException = Effect.fn('handleCoverageException')(function* (e: Error) {
  const disableWarning = workspace
    .getConfiguration()
    .get<boolean>('salesforcedx-vscode-apex-testing.disable-warnings-for-missing-coverage', false);
  if (disableWarning) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const svc = yield* api.services.ChannelService;
    yield* svc.appendToChannel(e.message);
  } else {
    yield* Effect.tryPromise(() =>
      window.showWarningMessage(nls.localize('colorizer_coverage_apply_failed_message', e.message))
    );
  }
});

export class CodeCoverageHandler {
  public coveredLines: Range[] = [];
  public uncoveredLines: Range[] = [];

  constructor(private statusBar: StatusBarToggle) {
    window.onDidChangeActiveTextEditor(async editor => await this.onDidChangeActiveTextEditor(editor), this);
    void this.onDidChangeActiveTextEditor(window.activeTextEditor);
  }

  public async onDidChangeActiveTextEditor(editor?: TextEditor) {
    if (editor && this.statusBar.isHighlightingEnabled) {
      try {
        const coverage = await applyCoverageToSource(editor.document);
        this.coveredLines = coverage.coveredLines;
        this.uncoveredLines = coverage.uncoveredLines;
        this.setCoverageDecorators(editor);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        void getApexTestingRuntime().runPromise(handleCoverageException(err));
      }
    }
  }

  public async toggleCoverage() {
    const editor = window.activeTextEditor;
    if (this.statusBar.isHighlightingEnabled) {
      this.statusBar.toggle(false);
      this.coveredLines = [];
      this.uncoveredLines = [];
      if (editor) {
        this.setCoverageDecorators(editor);
      }
    } else {
      try {
        if (editor?.document) {
          const coverage = await applyCoverageToSource(editor.document);
          this.coveredLines = coverage.coveredLines;
          this.uncoveredLines = coverage.uncoveredLines;
          this.setCoverageDecorators(editor);
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        void getApexTestingRuntime().runPromise(handleCoverageException(err));
      }
      this.statusBar.toggle(true);
    }
  }

  private setCoverageDecorators(editor: TextEditor) {
    editor.setDecorations(coveredLinesDecorationType, this.coveredLines);
    editor.setDecorations(uncoveredLinesDecorationType, this.uncoveredLines);
  }
}

const applyCoverageToSource = async (
  document?: TextDocument
): Promise<{
  coveredLines: Range[];
  uncoveredLines: Range[];
}> => {
  if (
    document &&
    !docPath(document).includes(SFDX_FOLDER) &&
    isApexMetadata(docPath(document)) &&
    !IS_TEST_REG_EXP.test(document.getText())
  ) {
    const codeCovArray = await getCoverageData();
    const apexMemberName = getApexMemberName(document);
    const codeCovItem = codeCovArray.find(covItem => covItem.name === apexMemberName);

    if (!codeCovItem) {
      throw new Error(nls.localize('colorizer_no_code_coverage_current_file', docPath(document)));
    }

    if (isCodeCoverageItem(codeCovItem)) {
      return {
        coveredLines: Object.entries(codeCovItem.lines)
          .filter(([, value]) => value === 1)
          .map(([key]) => getLineRange(document, Number(key))),
        uncoveredLines: Object.entries(codeCovItem.lines)
          .filter(([, value]) => value !== 1)
          .map(([key]) => getLineRange(document, Number(key)))
      };
    }
    return {
      coveredLines: codeCovItem.coveredLines.map(cov => getLineRange(document, Number(cov))),
      uncoveredLines: codeCovItem.uncoveredLines.map(uncov => getLineRange(document, Number(uncov)))
    };
  }
  return {
    coveredLines: [],
    uncoveredLines: []
  };
};

const isCodeCoverageItem = (item: CoverageItem | CodeCoverageResult): item is CoverageItem => 'lines' in item;
