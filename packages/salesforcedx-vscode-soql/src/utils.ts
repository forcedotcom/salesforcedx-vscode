import { TextDocument } from 'vscode';

export function getDocumentName(document: TextDocument) {
  const documentPath = document.uri.fsPath;
  return documentPath.split('/').pop();
}
