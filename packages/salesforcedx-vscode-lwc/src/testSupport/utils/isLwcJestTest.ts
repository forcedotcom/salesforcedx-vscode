import * as vscode from 'vscode';
import { LWC_TEST_DOCUMENT_SELECTOR } from '../types/constants';

export function isLwcJestTest(textDocument: vscode.TextDocument) {
  return vscode.languages.match(LWC_TEST_DOCUMENT_SELECTOR, textDocument);
}
