/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import { Range, TextDocument, TextEditor, window, workspace } from 'vscode';
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

function getLineRange(document: TextDocument, lineNumber: number): Range {
  const adjustedLineNumber = lineNumber - 1;
  const firstLine = document.lineAt(adjustedLineNumber);

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
    throw new Error('No test run information was found for this project.');
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
      `No code coverage information was found for test run ${testRunId}`
    );
  }
  const testResultOutput = fs.readFileSync(testResultFilePath, 'utf8');
  const codeCoverage = JSON.parse(testResultOutput) as CoverageTestResult;
  return codeCoverage.coverage ? codeCoverage.coverage.coverage : '';
}

function isApexMetadata(filePath: string): boolean {
  return filePath.endsWith('.cls') || filePath.endsWith('.trigger');
}

function getApexMemberName(filePath: string): string {
  if (isApexMetadata(filePath)) {
    const filePathWithOutType = filePath.replace(/.cls|.trigger/g, '');
    const indexOfLastFolder = filePathWithOutType.lastIndexOf('/');
    return filePathWithOutType.substring(indexOfLastFolder + 1);
  }
  return '';
}

export class CodeCoverage {
  private statusBar: StatusBarToggle;

  constructor(statusBar: StatusBarToggle) {
    this.statusBar = statusBar;

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
      const editor = window.activeTextEditor;
      if (editor) {
        editor.setDecorations(coveredLinesDecorationType, []);
        editor.setDecorations(uncoveredLinesDecorationType, []);
      }
    } else {
      this.colorizer(window.activeTextEditor);
      this.statusBar.toggle(true);
    }
  }

  private colorizer(editor?: TextEditor) {
    try {
      if (editor && isApexMetadata(editor.document.uri.fsPath)) {
        const codeCovArray = getCoverageData() as CoverageItem[];
        if (codeCovArray === undefined || codeCovArray.length === 0) {
          const testRunId = getTestRunId();
          throw new Error(
            `No code coverage information was found for test run ${testRunId}.`
          );
        }
        const coveredLines = Array<Range>();
        const uncoveredLines = Array<Range>();
        const codeCovItem = codeCovArray.find(
          covItem =>
            covItem.name === getApexMemberName(editor.document.uri.fsPath)
        );

        if (!codeCovItem) {
          throw new Error(
            'No code coverage information was found for the current file.'
          );
        }

        for (const key in codeCovItem.lines) {
          if (codeCovItem.lines.hasOwnProperty(key)) {
            if (codeCovItem.lines[key] === 1) {
              coveredLines.push(getLineRange(editor.document, Number(key)));
            } else {
              uncoveredLines.push(getLineRange(editor.document, Number(key)));
            }
          }
        }

        editor.setDecorations(coveredLinesDecorationType, coveredLines);
        editor.setDecorations(uncoveredLinesDecorationType, uncoveredLines);
      }
    } catch (e) {
      // telemetry
      window.showWarningMessage(e.message);
    }
  }
}
