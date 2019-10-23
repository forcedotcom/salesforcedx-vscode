import * as vscode from 'vscode';
import {
  LWC_TEST_DOCUMENT_SELECTOR,
  SFDX_LWC_JEST_FILE_FOCUSED_CONTEXT
} from '../types/constants';

function setLwcJestFileFocusedContext(textEditor?: vscode.TextEditor) {
  if (textEditor) {
    if (
      vscode.languages.match(LWC_TEST_DOCUMENT_SELECTOR, textEditor.document)
    ) {
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
