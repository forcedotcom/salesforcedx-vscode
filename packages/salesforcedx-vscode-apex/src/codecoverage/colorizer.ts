/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { StatusBarToggle } from './statusBarToggle';

const lime = (opacity: number): string => `rgba(45, 121, 11, ${opacity})`;
const red = (opacity: number): string => `rgba(253, 72, 73, ${opacity})`;

export function getLineRange(
  document: vscode.TextDocument,
  lineNumber: number
): vscode.Range {
  const adjustedLineNumber = lineNumber - 1;
  const firstLine = document.lineAt(adjustedLineNumber);

  return new vscode.Range(
    adjustedLineNumber,
    firstLine.range.start.character,
    adjustedLineNumber,
    firstLine.range.end.character
  );
}

const apexDirPath = path.join(
  vscode.workspace!.workspaceFolders![0].uri.fsPath,
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
  public coveredLinesDecorationType: vscode.TextEditorDecorationType;
  public uncoveredLinesCoverageDecorationType: vscode.TextEditorDecorationType;

  constructor(statusBar: StatusBarToggle) {
    this.statusBar = statusBar;
    this.coveredLinesDecorationType = vscode.window.createTextEditorDecorationType(
      {
        backgroundColor: lime(0.5),
        borderRadius: '.2em',
        overviewRulerColor: lime(0.5)
      }
    );
    this.uncoveredLinesCoverageDecorationType = vscode.window.createTextEditorDecorationType(
      {
        backgroundColor: red(0.5),
        borderRadius: '.2em',
        overviewRulerColor: red(0.5)
      }
    );

    vscode.window.onDidChangeActiveTextEditor(
      this.onDidChangeActiveTextEditor,
      this
    );
    this.onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
  }

  public onDidChangeActiveTextEditor(editor?: vscode.TextEditor) {
    if (editor && this.statusBar.isHighlightingEnabled) {
      console.log('this is the editor');
      getApexMemberName(editor.document.uri.fsPath);
      this.colorizer(editor);
    }
  }

  public showCoverage() {
    console.log('This should show code coverage');
    this.statusBar.toggle(true);
    this.colorizer(vscode.window.activeTextEditor);
  }

  public hideCoverage() {
    console.log('This should hide code coverage');
    this.statusBar.toggle(false);
    this.removeColor();
  }

  private removeColor() {
    console.log('what is up ??');
    // disposing this prevents from further enabling/disabling code cov
    // highlighting, need to do some sort of caching and just flush that
    // OR query for the data every time we change apex classes/triggers
    // this.coveredLinesDecorationType.dispose();
    // this.uncoveredLinesCoverageDecorationType.dispose();
  }

  private colorizer(editor?: vscode.TextEditor) {
    console.log('what is up ??');
    // const editor = vscode.window.activeTextEditor;
    if (editor) {
      const jsonSummary = getCoverageData();
      const coveredLines = Array<vscode.Range>();
      const uncoveredLines = Array<vscode.Range>();
      console.log('jsonSummary = ', jsonSummary);
      const convArray = jsonSummary.coverage.coverage;
      convArray.forEach((classCov: any) => {
        // can this be replaced by a find or map ?
        if (classCov.name === getApexMemberName(editor.document.uri.fsPath)) {
          const x = classCov.lines;
          console.log(x);
          for (const key in classCov.lines) {
            if (classCov.lines.hasOwnProperty(key)) {
              console.log(key, classCov.lines[key]);
              if (classCov.lines[key] === 1) {
                coveredLines.push(getLineRange(editor.document, Number(key)));
              } else {
                uncoveredLines.push(getLineRange(editor.document, Number(key)));
              }
            }
          }
        }
      });

      editor.setDecorations(this.coveredLinesDecorationType, coveredLines);
      editor.setDecorations(
        this.uncoveredLinesCoverageDecorationType,
        uncoveredLines
      );
    }
  }
}
