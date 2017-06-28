import * as vscode from 'vscode';
import { expect } from 'chai';

const PERFECT_MATCH = 10;

async function matchExtensionAsHtml(extension: string) {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.parse(`untitled:fake/path/doc.${extension}`)
  );
  expect(vscode.languages.match({ language: 'html' }, doc)).to.equal(
    PERFECT_MATCH
  );
}

suite('Extension tests', () => {
  test('.page association', async () => {
    matchExtensionAsHtml('.page');
  });

  test('.component association', async () => {
    matchExtensionAsHtml('.component');
  });
});
