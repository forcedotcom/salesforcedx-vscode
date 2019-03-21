/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Range,
  TextDocument,
  TextEditor,
  TextLine,
  window,
  workspace
} from 'vscode';
import { nls } from '../messages';
import {
  coveredLinesDecorationType,
  uncoveredLinesDecorationType
} from './decorations';
import { StatusBarToggle } from './statusBarToggle';

const apexDirPath = path.join(
  workspace!.workspaceFolders![0].uri.fsPath,
  '.sfdx',
  'tools',
  'testresults',
  'apex'
);

export function getLineRange(
  document: TextDocument,
  lineNumber: number
): Range {
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
}

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

function getTestRunId() {
  const testRunIdFile = path.join(apexDirPath, 'test-run-id.txt');
  if (!fs.existsSync(testRunIdFile)) {
    throw new Error(nls.localize('colorizer_no_code_coverage_files'));
  }
  return fs.readFileSync(testRunIdFile, 'utf8');
}

function getCoverageData() {
  const testRunId = getTestRunId();
  const testResultFilePath = path.join(
    apexDirPath,
    `test-result-${testRunId}.json`
  );

  if (!fs.existsSync(testResultFilePath)) {
    throw new Error(
      nls.localize('colorizer_no_code_coverage_on_test_results', testRunId)
    );
  }
  const testResultOutput = fs.readFileSync(testResultFilePath, 'utf8');
  const codeCoverage = JSON.parse(testResultOutput) as CoverageTestResult;
  if (codeCoverage.coverage === undefined) {
    throw new Error(
      nls.localize('colorizer_no_code_coverage_on_test_results', testRunId)
    );
  }
  return codeCoverage.coverage ? codeCoverage.coverage.coverage : '';
}

function isApexMetadata(filePath: string): boolean {
  return filePath.endsWith('.cls') || filePath.endsWith('.trigger');
}

function getApexMemberName(filePath: string): string {
  if (isApexMetadata(filePath)) {
    const filePathWithOutType = filePath.replace(/.cls|.trigger/g, '');
    const separator = process.platform === 'win32' ? '\\' : '/';
    const indexOfLastFolder = filePathWithOutType.lastIndexOf(separator);
    return filePathWithOutType.substring(indexOfLastFolder + 1);
  }
  return '';
}

export class CodeCoverage {
  private statusBar: StatusBarToggle;
  public coveredLines: Range[];
  public uncoveredLines: Range[];

  constructor(statusBar: StatusBarToggle) {
    this.statusBar = statusBar;
    this.coveredLines = Array<Range>();
    this.uncoveredLines = Array<Range>();

    window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this);
    this.onDidChangeActiveTextEditor(window.activeTextEditor);
  }

  public onDidChangeActiveTextEditor(editor?: TextEditor) {
    if (editor && this.statusBar.isHighlightingEnabled) {
      this.colorizer(editor);
    }
  }

  public toggleCoverage() {
    if (this.statusBar.isHighlightingEnabled) {
      this.statusBar.toggle(false);
      this.coveredLines = [];
      this.uncoveredLines = [];

      const editor = window.activeTextEditor;
      if (editor) {
        editor.setDecorations(coveredLinesDecorationType, this.coveredLines);
        editor.setDecorations(
          uncoveredLinesDecorationType,
          this.uncoveredLines
        );
      }
    } else {
      this.colorizer(window.activeTextEditor);
      this.statusBar.toggle(true);
    }
  }

  public colorizer(editor?: TextEditor) {
    try {
      if (editor && isApexMetadata(editor.document.uri.fsPath)) {
        const codeCovArray = getCoverageData() as CoverageItem[];
        const codeCovItem = codeCovArray.find(
          covItem =>
            covItem.name === getApexMemberName(editor.document.uri.fsPath)
        );

        if (!codeCovItem) {
          throw new Error(
            nls.localize('colorizer_no_code_coverage_current_file')
          );
        }

        for (const key in codeCovItem.lines) {
          if (codeCovItem.lines.hasOwnProperty(key)) {
            if (codeCovItem.lines[key] === 1) {
              this.coveredLines.push(
                getLineRange(editor.document, Number(key))
              );
            } else {
              this.uncoveredLines.push(
                getLineRange(editor.document, Number(key))
              );
            }
          }
        }

        editor.setDecorations(coveredLinesDecorationType, this.coveredLines);
        editor.setDecorations(
          uncoveredLinesDecorationType,
          this.uncoveredLines
        );
      }
    } catch (e) {
      // telemetry
      window.showWarningMessage(e.message);
    }
  }
}
