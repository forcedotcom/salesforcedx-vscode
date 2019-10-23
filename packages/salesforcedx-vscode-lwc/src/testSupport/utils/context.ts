import * as vscode from 'vscode';

import { SFDX_LWC_JEST_FILE_FOCUSED_CONTEXT } from '../types/constants';
import { isLwcJestTest } from './isLwcJestTest';

function setLwcJestFileFocusedContext(textEditor?: vscode.TextEditor) {
  if (textEditor) {
    if (isLwcJestTest(textEditor.document)) {
      vscode.commands.executeCommand(
        'setContext',
        SFDX_LWC_JEST_FILE_FOCUSED_CONTEXT,
        true
      );
    } else {
      vscode.commands.executeCommand(
        'setContext',
        SFDX_LWC_JEST_FILE_FOCUSED_CONTEXT,
        false
      );
    }
  } else {
    vscode.commands.executeCommand(
      'setContext',
      SFDX_LWC_JEST_FILE_FOCUSED_CONTEXT,
      false
    );
  }
}

export function startWatchingEditorFocusChange(
  context: vscode.ExtensionContext
) {
  setLwcJestFileFocusedContext(vscode.window.activeTextEditor);
  const handleDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor(
    textEditor => {
      setLwcJestFileFocusedContext(textEditor);
    }
  );
  context.subscriptions.push(handleDidChangeActiveTextEditor);
}
