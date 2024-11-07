/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CodeCoverageResult } from '@salesforce/apex-node-bundle';
import { SFDX_FOLDER, projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import { existsSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';
import { Range, TextDocument, TextEditor, TextLine, window, workspace } from 'vscode';
import { channelService } from '../channels';
import { IS_CLS_OR_TRIGGER, IS_TEST_REG_EXP } from '../constants';
import { nls } from '../messages';
import { coveredLinesDecorationType, uncoveredLinesDecorationType } from './decorations';
import { StatusBarToggle } from './statusBarToggle';

export const pathToApexTestResultsFolder = projectPaths.apexTestResultsFolder();

export const getLineRange = (document: TextDocument, lineNumber: number): Range => {
  let adjustedLineNumber: number;
  let firstLine: TextLine;
  try {
    adjustedLineNumber = lineNumber - 1;
    firstLine = document.lineAt(adjustedLineNumber);
  } catch (e) {
    throw new Error(nls.localize('colorizer_out_of_sync_code_coverage_data'));
  }

  return new Range(
    adjustedLineNumber,
    firstLine.range.start.character,
    adjustedLineNumber,
    firstLine.range.end.character
  );
};

export type CoverageTestResult = {
  coverage: {
    coverage: CoverageItem[];
  };
};

export type CoverageItem = {
  id: string;
  name: string;
  totalLines: number;
  lines: { [key: string]: number };
};

const getTestRunId = (): string => {
  const testRunIdFile = join(pathToApexTestResultsFolder, 'test-run-id.txt');
  if (!existsSync(testRunIdFile)) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_project'));
  }
  return readFileSync(testRunIdFile, 'utf8');
};

const getCoverageData = (): CoverageItem[] | CodeCoverageResult[] => {
  const testRunId = getTestRunId();
  const testResultFilePath = join(pathToApexTestResultsFolder, `test-result-${testRunId}.json`);

  if (!existsSync(testResultFilePath)) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_test_results', testRunId));
  }
  const testResultOutput = readFileSync(testResultFilePath, 'utf8');
  const testResult = JSON.parse(testResultOutput);
  if (testResult.coverage === undefined && testResult.codecoverage === undefined) {
    throw new Error(nls.localize('colorizer_no_code_coverage_on_test_results', testRunId));
  }

  return testResult.codecoverage || testResult.coverage.coverage;
};

const isApexMetadata = (filePath: string): boolean => {
  return IS_CLS_OR_TRIGGER.test(filePath);
};

const getApexMemberName = (filePath: string): string => {
  if (isApexMetadata(filePath)) {
    const extension = extname(filePath);
    return basename(filePath, extension);
  }
  return '';
};

export class CodeCoverageHandler {
  public coveredLines: Range[] = [];
  public uncoveredLines: Range[] = [];

  constructor(private statusBar: StatusBarToggle) {
    window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this);
    this.onDidChangeActiveTextEditor(window.activeTextEditor);
  }

  public onDidChangeActiveTextEditor(editor?: TextEditor) {
    if (editor && this.statusBar.isHighlightingEnabled) {
      try {
        const coverage = applyCoverageToSource(editor.document);
        this.coveredLines = coverage.coveredLines;
        this.uncoveredLines = coverage.uncoveredLines;
        this.setCoverageDecorators(editor);
      } catch (e) {
        this.handleCoverageException(e);
      }
    }
  }

  public toggleCoverage() {
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
          const coverage = applyCoverageToSource(editor.document);
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

const applyCoverageToSource = (
  document?: TextDocument
): {
  coveredLines: Range[];
  uncoveredLines: Range[];
} => {
  let coveredLines = Array<Range>();
  let uncoveredLines = Array<Range>();
  if (
    document &&
    !document.uri.fsPath.includes(SFDX_FOLDER) &&
    isApexMetadata(document.uri.fsPath) &&
    !IS_TEST_REG_EXP.test(document.getText())
  ) {
    const codeCovArray = getCoverageData() as { name: string }[];
    const apexMemberName = getApexMemberName(document.uri.fsPath);
    const codeCovItem = codeCovArray.find(covItem => covItem.name === apexMemberName);

    if (!codeCovItem) {
      throw new Error(nls.localize('colorizer_no_code_coverage_current_file', document.uri.fsPath));
    }

    if (Reflect.has(codeCovItem, 'lines') && !Reflect.has(codeCovItem, 'uncoveredLines')) {
      const covItem = codeCovItem as CoverageItem;
      for (const key in covItem.lines) {
        if (covItem.lines[key] === 1) {
          coveredLines.push(getLineRange(document, Number(key)));
        } else {
          uncoveredLines.push(getLineRange(document, Number(key)));
        }
      }
    } else {
      const covResult = codeCovItem as CodeCoverageResult;
      coveredLines = covResult.coveredLines.map(cov => getLineRange(document, Number(cov)));
      uncoveredLines = covResult.uncoveredLines.map(uncov => getLineRange(document, Number(uncov)));
    }
  }
  return { coveredLines, uncoveredLines };
};

// export is for testing
export const colorizer = {
  applyCoverageToSource
};
