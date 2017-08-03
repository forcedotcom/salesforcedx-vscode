/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as vscode from 'vscode';

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
    matchExtensionAsHtml('.app_bogus');
  });

  it('Should support .cmp association', async () => {
    matchExtensionAsHtml('.cmp_bogus');
  });

  it('Should support .design association', async () => {
    matchExtensionAsHtml('.design_bogus');
  });

  it('Should support .evt association', async () => {
    matchExtensionAsHtml('.evt_bogus');
  });

  it('Should support.intf association', async () => {
    matchExtensionAsHtml('.intf_bogus');
  });

  it('Should support .auradoc association', async () => {
    matchExtensionAsHtml('.auradoc_bogus');
  });

  it('Should support .tokens association', async () => {
    await matchExtensionAsHtml('.tokens');
  });
});
