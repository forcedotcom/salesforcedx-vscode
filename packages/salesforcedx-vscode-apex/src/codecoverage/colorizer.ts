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

export function getLineRange(
  document: TextDocument,
  lineNumber: number
): Range {
  const adjustedLineNumber = lineNumber - 1;
  const firstLine = document.lineAt(adjustedLineNumber);

  return new Range(
    adjustedLineNumber,
    firstLine.range.start.character,
    adjustedLineNumber,
    firstLine.range.end.character
  );
}

const apexDirPath = path.join(
  workspace!.workspaceFolders![0].uri.fsPath,
  '.sfdx',
  'tools',
  'testresults',
  'apex'
);

function getCoverageData() {
  const testRunIdFile = path.join(apexDirPath, 'test-run-id.txt');
  const testRunId = fs.readFileSync(testRunIdFile);
  const testResultFilePath = path.join(
    apexDirPath,
    'test-result-' + testRunId + '.json'
  );

  const testResultOutput = fs.readFileSync(testResultFilePath, 'utf8');
  return JSON.parse(testResultOutput);
}

function getApexMemberName(filePath: string): string {
  if (filePath.endsWith('.cls') || filePath.endsWith('.trigger')) {
    const filePathWithOutType = filePath.replace('.cls', '');
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
      getApexMemberName(editor.document.uri.fsPath);
      this.colorizer(editor);
    }
  }

  public showCoverage() {
    this.statusBar.toggle(true);
    this.colorizer(window.activeTextEditor);
  }

  public hideCoverage() {
    this.statusBar.toggle(false);
    const editor = window.activeTextEditor;
    if (editor) {
      editor.setDecorations(coveredLinesDecorationType, []);
      editor.setDecorations(uncoveredLinesDecorationType, []);
    }
  }

  private colorizer(editor?: TextEditor) {
    if (editor) {
      const jsonSummary = getCoverageData();
      const coveredLines = Array<Range>();
      const uncoveredLines = Array<Range>();
      const convArray = jsonSummary.coverage.coverage;

      convArray.forEach((classCov: any) => {
        // can this be replaced by a find or map ?
        if (classCov.name === getApexMemberName(editor.document.uri.fsPath)) {
          for (const key in classCov.lines) {
            if (classCov.lines.hasOwnProperty(key)) {
              if (classCov.lines[key] === 1) {
                coveredLines.push(getLineRange(editor.document, Number(key)));
              } else {
                uncoveredLines.push(getLineRange(editor.document, Number(key)));
              }
            }
          }
        }
      });

      editor.setDecorations(coveredLinesDecorationType, coveredLines);
      editor.setDecorations(uncoveredLinesDecorationType, uncoveredLines);
    }
  }
}
