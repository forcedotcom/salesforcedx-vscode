/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CodeCoverageResult } from '@salesforce/apex-node';
import { SFDX_FOLDER, projectPaths, fileOrFolderExists, readFile } from '@salesforce/salesforcedx-utils-vscode';
import { join, extname, basename } from 'node:path';
import { Range, TextDocument, TextEditor, window, workspace } from 'vscode';
import { channelService } from '../channels';
import { IS_CLS_OR_TRIGGER, IS_TEST_REG_EXP } from '../constants';
import { nls } from '../messages';
import { coveredLinesDecorationType, uncoveredLinesDecorationType } from './decorations';
import { StatusBarToggle } from './statusBarToggle';

const pathToApexTestResultsFolder = projectPaths.apexTestResultsFolder();

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

const getTestRunId = async (): Promise<string> => {
  const testRunIdFile = join(pathToApexTestResultsFolder, 'test-run-id.txt');
  if (!(await fileOrFolderExists(testRunIdFile))) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_project'));
  }
  return readFile(testRunIdFile);
};

const getCoverageData = async (): Promise<CoverageItem[] | CodeCoverageResult[]> => {
  const testRunId = await getTestRunId();
  const testResultFilePath = join(pathToApexTestResultsFolder, `test-result-${testRunId}.json`);

  if (!(await fileOrFolderExists(testResultFilePath))) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_test_results', testRunId));
  }
  const testResultOutput = await readFile(testResultFilePath);
  const testResult = JSON.parse(testResultOutput);
  if (testResult.coverage === undefined && testResult.codecoverage === undefined) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_test_results', testRunId));
  }

  return testResult.codecoverage || testResult.coverage.coverage;
};

const isApexMetadata = (filePath: string): boolean => IS_CLS_OR_TRIGGER.test(filePath);

const getApexMemberName = (filePath: string): string =>
  isApexMetadata(filePath) ? basename(filePath, extname(filePath)) : '';

export class CodeCoverageHandler {
  public coveredLines: Range[] = [];
  public uncoveredLines: Range[] = [];

  constructor(private statusBar: StatusBarToggle) {
    window.onDidChangeActiveTextEditor(async () => await this.onDidChangeActiveTextEditor(), this);
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
        this.handleCoverageException(e);
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
        // telemetry
        this.handleCoverageException(e);
      }
      this.statusBar.toggle(true);
    }
  }

  private handleCoverageException(e: Error) {
    const disableWarning: boolean = workspace
      .getConfiguration()
      .get<boolean>('salesforcedx-vscode-apex.disable-warnings-for-missing-coverage', false);
    if (disableWarning) {
      channelService.appendLine(e.message);
    } else {
      void window.showWarningMessage(e.message);
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
    !document.uri.fsPath.includes(SFDX_FOLDER) &&
    isApexMetadata(document.uri.fsPath) &&
    !IS_TEST_REG_EXP.test(document.getText())
  ) {
    const codeCovArray = await getCoverageData();
    const apexMemberName = getApexMemberName(document.uri.fsPath);
    const codeCovItem = codeCovArray.find(covItem => covItem.name === apexMemberName);

    if (!codeCovItem) {
      throw new Error(nls.localize('colorizer_no_code_coverage_current_file', document.uri.fsPath));
    }

    if (isCodeCoverageItem(codeCovItem)) {
      return {
        // TODO node 22: use native js object.groupBy
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
