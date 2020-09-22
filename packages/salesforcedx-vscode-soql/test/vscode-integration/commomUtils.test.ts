/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as vscode from 'vscode';
import { getDocumentName } from '../../src/commonUtils';
import { MockTextDocumentProvider } from './testUtilities';

describe('Common SOQL Builder Utilities', () => {
  let mockTextDocument: vscode.TextDocument;
  let docProviderDisposable: vscode.Disposable;

  beforeEach(async () => {
    docProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
      'sfdc-test',
      new MockTextDocumentProvider()
    );
    mockTextDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.parse('sfdc-test:test/examples/soql/mocksoql.soql')
    );
  });

  afterEach(() => {
    docProviderDisposable.dispose();
  });

  it('gets the document name form path', () => {
    const documentName = getDocumentName(mockTextDocument);
    expect(documentName).equals('mocksoql.soql');
  });
});
