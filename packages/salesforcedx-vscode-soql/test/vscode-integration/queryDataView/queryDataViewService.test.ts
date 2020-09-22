/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { getDocumentName } from '../../../src/commonUtils';
import { QueryDataViewService } from '../../../src/queryResultsView/queryDataViewService';
import { mockQueryData, MockTextDocumentProvider } from '../testUtilities';

describe('Query Data View Service', () => {
  let mockTextDocument: vscode.TextDocument;
  let docProviderDisposable: vscode.Disposable;
  let mockSubscription: vscode.Disposable[];
  let mockWebviewPanel: vscode.WebviewPanel;
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    docProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
      'sfdc-test',
      new MockTextDocumentProvider()
    );
    mockTextDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.parse('sfdc-test:test/examples/soql/mocksoql.soql')
    );
    mockSubscription = [{} as vscode.Disposable];
    mockWebviewPanel = vscode.window.createWebviewPanel(
      'mockWebviewPanel',
      'Mock Webview Panel',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
  });

  afterEach(() => {
    docProviderDisposable.dispose();
  });

  it('should post message to webview with query data', () => {
    const queryRecords = mockQueryData.records;
    const dataViewService = new QueryDataViewService(
      mockSubscription,
      queryRecords,
      mockTextDocument
    );

    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');
    QueryDataViewService.extensionPath = '';
    sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockWebviewPanel);
    dataViewService.createOrShowWebView();
    expect(postMessageSpy.callCount).equal(1);
    const postMessageArgs = postMessageSpy.args[0][0];
    expect(postMessageArgs.data).to.eql(mockQueryData.records);
    expect(postMessageArgs.documentName).equal(
      getDocumentName(mockTextDocument)
    );
    expect(postMessageArgs.type).equal('update');
  });
});
