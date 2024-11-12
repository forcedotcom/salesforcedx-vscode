/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Context } from 'mocha';
import * as vscode from 'vscode';

const PERFECT_MATCH = 10;

const matchExtensionAsHtml = async (extension: string) => {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(`untitled:fake/path/doc.${extension}`));
  expect(vscode.languages.match({ language: 'html' }, doc)).to.equal(PERFECT_MATCH);
};

describe('Lightning file association', () => {
  it('Should support .app association', async () => {
    await matchExtensionAsHtml('.app');
  });

  it('Should support .cmp association', async () => {
    await matchExtensionAsHtml('.cmp');
  });

  it('Should support .design association', async () => {
    await matchExtensionAsHtml('.design');
  });

  it('Should support .evt association', async () => {
    await matchExtensionAsHtml('.evt');
  });

  it('Should support.intf association', async () => {
    await matchExtensionAsHtml('.intf');
  });

  it('Should support .auradoc association', async () => {
    await matchExtensionAsHtml('.auradoc');
  });

  it('Should support .tokens association', async () => {
    await matchExtensionAsHtml('.tokens');
  });
});

describe('Test commands', () => {
  let coreExtension: vscode.Extension<any>;
  let auraExtension: vscode.Extension<any>;

  beforeEach(async () => {
    if (vscode.workspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
      coreExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core') as vscode.Extension<any>;

      auraExtension = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-lightning'
      ) as vscode.Extension<any>;
    }
  });

  it('coreExtension activation', async function (this: Context) {
    this.timeout(10000);
    await coreExtension.activate();
    expect(coreExtension.isActive);
  });

  it('aura activation', async function (this: Context) {
    this.timeout(10000);
    await auraExtension.activate();
    expect(auraExtension.isActive);
  });
});
