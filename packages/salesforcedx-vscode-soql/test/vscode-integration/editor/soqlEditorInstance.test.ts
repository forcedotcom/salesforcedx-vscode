/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as commonUtils from '../../../src/commonUtils';
import { MessageType } from '../../../src/editor/soqlEditorInstance';
import {
  mockSObject,
  MockTextDocumentProvider,
  TestSoqlEditorInstance
} from '../testUtilities';

describe('SoqlEditorInstance should', () => {
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
    const expected = { type: 'connection_changed' };
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    instance.onConnectionChanged();

    expect(postMessageSpy.calledWith(expected));
  });

  it('responds to sobjects_request with a list of sobjects', async () => {
    const expectedMessage = {
      type: 'sobjects_response',
      payload: ['A', 'B']
    };
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    instance.mockReceiveEvent({ type: 'sobjects_request' });
    // above function has nested async message passing; wait a bit
    await waitForAsync(50);

    expect(postMessageSpy.calledWith(expectedMessage));
  });

  it('responds to sobject_metadata_request with SObject metadata', async () => {
    const expectedMessage = {
      type: 'sobject_metadata_response',
      payload: mockSObject
    };
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    instance.mockReceiveEvent({
      type: 'sobject_metadata_request',
      payload: 'A'
    });
    // above function has nested async message passing; wait a bit
    await waitForAsync(50);

    expect(postMessageSpy.calledWith(expectedMessage));
  });

  it('handles query event and updates text document with soql', async () => {
    const aQuery = 'select a,b,c from somewhere';
    const updateDocumentSpy = sandbox.spy(instance, 'updateTextDocument');
    instance.mockReceiveEvent({
      type: MessageType.UI_SOQL_CHANGED,
      payload: aQuery
    });
    expect(
      updateDocumentSpy.callCount === 1,
      `updateDocumentSpy callcount expected 1, but got ${updateDocumentSpy.callCount}`
    );
    expect(updateDocumentSpy.getCall(0).args[1]).to.equal(aQuery);
  });

  it('muffles the postMessage once if soql statement has NOT changed', async () => {
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');
    const aQuery = 'select a,b,c from somewhere';
    instance.mockReceiveEvent({
      type: MessageType.UI_SOQL_CHANGED,
      payload: aQuery
    });
    // attempt to update webview with unchanged soql statement
    instance.updateWebview(mockTextDocument);
    expect(
      postMessageSpy.callCount === 0,
      `postMessageSpy callcount expected 0, but got ${postMessageSpy.callCount}`
    );
    // a second update with the same statement will send
    instance.updateWebview(mockTextDocument);
    expect(
      postMessageSpy.callCount === 1,
      `postMessageSpy callcount expected 1, but got ${postMessageSpy.callCount}`
    );
  });

  it('does emit if soql statement has changed', async () => {
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');
    const aQuery = 'select a,b,c from somewhere';
    instance.mockReceiveEvent({
      type: MessageType.UI_SOQL_CHANGED,
      payload: aQuery
    });
    instance.updateTextDocument(mockTextDocument, 'select d from somewhere');
    instance.updateWebview(mockTextDocument);
    expect(
      postMessageSpy.callCount === 1,
      `postMessageSpy callcount expected 1, but got ${postMessageSpy.callCount}`
    );
  });

  it('handles activation event and updates the webview', async () => {
    const updateWebviewSpy = sandbox.spy(instance, 'updateWebview');
    instance.mockReceiveEvent({
      type: MessageType.UI_ACTIVATED
    });
    expect(
      updateWebviewSpy.callCount === 1,
      `updateWebviewSpy callcount expected 1, but got ${updateWebviewSpy.callCount}`
    );
  });

  it('handles run query event and opens the webview and sends run_query_done to webview', async () => {
    const expectedMessage = {
      type: 'run_query_done'
    };
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    const openQueryResultsSpy = sandbox.spy(instance, 'openQueryDataView');
    instance.mockReceiveEvent({
      type: MessageType.RUN_SOQL_QUERY
    });

    expect(
      openQueryResultsSpy.callCount === 1,
      `openQueryResultsSpy callcount expected 1, but got ${openQueryResultsSpy.callCount}`
    );
    expect(postMessageSpy.calledWith(expectedMessage));
  });

  it('display and track error wheb webview.postMessage throws', async () => {
    sandbox.stub(mockWebviewPanel.webview, 'postMessage').rejects();
    const trackErrorSpy = sandbox.spy(commonUtils, 'trackErrorWithTelemetry');

    instance.sendMessageToUi('message-type', 'message-body');

    return Promise.resolve().then(() => {
      expect(trackErrorSpy.callCount).to.equal(1);
    });
  });

  it('handles telemetry events and tracks when there is unsupported syntax', async () => {
    const trackErrorSpy = sandbox.spy(commonUtils, 'trackErrorWithTelemetry');
    instance.mockReceiveEvent({
      type: MessageType.UI_TELEMETRY,
      payload: { unsupported: 1 }
    });
    return Promise.resolve().then(() => {
      expect(trackErrorSpy.callCount).to.equal(1);
      expect(trackErrorSpy.getCall(0).args[0]).to.equal('syntax_unsupported');
    });
  });

  it('handles telemetry errors and unsupported properties as numbers AND arrays', async () => {
    const trackErrorSpy = sandbox.spy(commonUtils, 'trackErrorWithTelemetry');
    const telemetryEvent = {
      type: MessageType.UI_TELEMETRY,
      payload: { unsupported: ['WHERE 1 = 1'] }
    };
    instance.mockReceiveEvent(telemetryEvent);
    return Promise.resolve().then(() => {
      expect(trackErrorSpy.callCount).to.equal(1);
      expect(trackErrorSpy.getCall(0).args[0]).to.equal('syntax_unsupported');
      expect(trackErrorSpy.getCall(0).args[1]).contains(
        telemetryEvent.payload.unsupported[0]
      );
    });
  });
});
