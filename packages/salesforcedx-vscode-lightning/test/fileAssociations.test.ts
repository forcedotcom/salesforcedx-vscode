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

describe('Lightning file association', () => {
  it('Should support .app association', async () => {
    matchExtensionAsHtml('.app');
  });

  it('Should support .cmp association', async () => {
    matchExtensionAsHtml('.cmp');
  });

  it('Should support .design association', async () => {
    matchExtensionAsHtml('.design');
  });

  it('Should support .evt association', async () => {
    matchExtensionAsHtml('.evt');
  });

  it('Should support.intf association', async () => {
    matchExtensionAsHtml('.intf');
  });

  it('Should support .auradoc association', async () => {
    matchExtensionAsHtml('.auradoc');
  });

  it('Should support .tokens association', async () => {
    matchExtensionAsHtml('.tokens');
  });
});
