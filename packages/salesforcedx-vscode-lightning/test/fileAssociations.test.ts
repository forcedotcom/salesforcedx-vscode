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
  test('.app association', async () => {
    matchExtensionAsHtml('.app');
  });

  test('.cmp association', async () => {
    matchExtensionAsHtml('.cmp');
  });

  test('.design association', async () => {
    matchExtensionAsHtml('.design');
  });

  test('.evt association', async () => {
    matchExtensionAsHtml('.evt');
  });

  test('.intf association', async () => {
    matchExtensionAsHtml('.intf');
  });

  test('.auradoc association', async () => {
    matchExtensionAsHtml('.auradoc');
  });

  test('.tokens association', async () => {
    matchExtensionAsHtml('.tokens');
  });
});
