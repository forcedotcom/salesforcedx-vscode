/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode/out/src/context';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { MessageType } from '../../../src/editor/soqlEditorInstance';
import {
  getMockConnection,
  MockConnection,
  mockSObject,
  MockTextDocumentProvider,
  TestSoqlEditorInstance
} from '../testUtilities';

const workspaceContext = WorkspaceContextUtil.getInstance();

describe('SoqlEditorInstance should', () => {
  let mockConnection: MockConnection;
  let mockWebviewPanel: vscode.WebviewPanel;
  let docProviderDisposable: vscode.Disposable;
  let mockTextDocument: vscode.TextDocument;
  let instance: TestSoqlEditorInstance;
  let sandbox: sinon.SinonSandbox;

  const createMessagingWebviewContent = () => {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Messaging Webview</title>
    </head>
    <body>
    </body>
    </html>`;
  };

  const waitForAsync = async (msec: number) => {
    return new Promise(resolve => setTimeout(resolve, msec));
  };

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    mockConnection = getMockConnection(sandbox);
    docProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
      'sfdc-test',
      new MockTextDocumentProvider()
    );
    mockTextDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.parse('sfdc-test:mocksoql.soql')
    );
    mockWebviewPanel = vscode.window.createWebviewPanel(
      'mockWebviewPanel',
      'Mock Webview Panel',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    mockWebviewPanel.webview.html = createMessagingWebviewContent();
    instance = new TestSoqlEditorInstance(
      mockTextDocument,
      mockWebviewPanel,
      new vscode.CancellationTokenSource().token
    );
  });
  afterEach(() => {
    mockWebviewPanel.dispose();
    docProviderDisposable.dispose();
    sandbox.restore();
  });

  it('post CONNECTION_CHANGED message when connection is changed', async () => {
    sandbox.stub(workspaceContext, 'getConnection').returns(mockConnection);
    const expected = { type: 'connection_changed' };
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    instance.onConnectionChanged();

    expect(postMessageSpy.calledWith(expected));
  });

  it('responds to sobjects_request with a list of sobjects', async () => {
    sandbox.stub(workspaceContext, 'getConnection').returns(mockConnection);

    const expectedMessage = {
      type: 'sobjects_response',
      payload: ['A', 'B']
    };
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    instance.sendEvent({ type: 'sobjects_request' });
    // above function has nested async message passing; wait a bit
    await waitForAsync(50);

    expect(postMessageSpy.calledWith(expectedMessage));
  });

  it('responds to sobject_metadata_request with SObject metadata', async () => {
    sandbox.stub(workspaceContext, 'getConnection').returns(mockConnection);

    const expectedMessage = {
      type: 'sobject_metadata_response',
      payload: mockSObject
    };
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    instance.sendEvent({ type: 'sobject_metadata_request', payload: 'A' });
    // above function has nested async message passing; wait a bit
    await waitForAsync(50);

    expect(postMessageSpy.calledWith(expectedMessage));
  });

  it('handles query event and updates text document with soql', async () => {
    const aQuery = 'select a,b,c from somewhere';
    const updateDocumentSpy = sandbox.spy(instance, 'updateTextDocument');
    instance.sendEvent({
      type: MessageType.UI_SOQL_CHANGED,
      payload: aQuery
    });
    expect(
      updateDocumentSpy.callCount === 1,
      `updateDocumentSpy callcount expected 1, but got ${updateDocumentSpy.callCount}`
    );
    expect(updateDocumentSpy.getCall(0).args[1]).to.equal(aQuery);
  });

  it('handles activation event and updates the webview', async () => {
    const updateWebviewSpy = sandbox.spy(instance, 'updateWebview');
    instance.sendEvent({
      type: MessageType.UI_ACTIVATED
    });
    expect(
      updateWebviewSpy.callCount === 1,
      `updateWebviewSpy callcount expected 1, but got ${updateWebviewSpy.callCount}`
    );
  });

  it('handles run query event and opens the webview', async () => {
    const openQueryResultsSpy = sandbox.spy(instance, 'openQueryDataView');
    instance.sendEvent({
      type: MessageType.RUN_SOQL_QUERY
    });
    expect(
      openQueryResultsSpy.callCount === 1,
      `openQueryResultsSpy callcount expected 1, but got ${openQueryResultsSpy.callCount}`
    );
  });
});
