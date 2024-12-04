/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as vscode from 'vscode';

const PERFECT_MATCH = 10;

const matchExtensionAsHtml = async (extension: string) => {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(`untitled:fake/path/doc.${extension}`));
  expect(vscode.languages.match({ language: 'visualforce' }, doc)).to.equal(PERFECT_MATCH);
};

describe('Visualforce file association', () => {
  it('Should support .page association', async () => {
    await matchExtensionAsHtml('.page');
  });

  it('Should support .component association', async () => {
    await matchExtensionAsHtml('.component');
  });
});
