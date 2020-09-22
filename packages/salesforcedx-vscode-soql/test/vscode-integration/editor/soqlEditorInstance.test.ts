/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  MessageType,
  SoqlEditorEvent,
  SOQLEditorInstance
} from '../../../src/editor/soqlEditorInstance';
import { ToolingModelJson } from '../../../src/editor/soqlUtils';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);
const sfdxCoreExports = sfdxCoreExtension
  ? sfdxCoreExtension.exports
  : undefined;
const { OrgAuthInfo } = sfdxCoreExports;

describe('SoqlEditorInstance should', () => {
  const $$ = testSetup();
  const testData = new MockTestOrgData();

  let mockConnection: Connection;
  let mockWebviewPanel: vscode.WebviewPanel;
  let docProviderDisposable: vscode.Disposable;
  let mockTextDocument: vscode.TextDocument;
  let instance: TestSoqlEditorInstance;
  let sandbox: sinon.SinonSandbox;

  const uiModelOne: ToolingModelJson = {
    sObject: 'Account',
    fields: ['Name', 'Id']
  };

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
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sandbox
      .stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
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
    $$.SANDBOX.restore();
    sandbox.restore();
  });

  it('responds to sobjects_request with a list of sobjects', async () => {
    sandbox
      .stub(OrgAuthInfo, 'getDefaultUsernameOrAlias')
      .returns(testData.username);
    sandbox.stub(OrgAuthInfo, 'getConnection').returns(mockConnection);
    const describeGlobalResponse = {
      sobjects: [{ name: 'A' }, { name: 'B' }]
    };
    sandbox
      .stub(mockConnection, 'describeGlobal')
      .resolves(describeGlobalResponse);

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
    sandbox
      .stub(OrgAuthInfo, 'getDefaultUsernameOrAlias')
      .returns(testData.username);
    sandbox.stub(OrgAuthInfo, 'getConnection').returns(mockConnection);
    const fakeSObject = { name: 'A' };
    sandbox
      .stub(mockConnection, 'describe')
      .resolves(fakeSObject);

    const expectedMessage = {
      type: 'sobject_metadata_response',
      payload: fakeSObject
    };
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    instance.sendEvent({ type: 'sobject_metadata_request' });
    // above function has nested async message passing; wait a bit
    await waitForAsync(50);

    expect(postMessageSpy.calledWith(expectedMessage));
  });

  it('handles query event and updates text document with soql', async () => {
    const updateDocumentSpy = sandbox.spy(instance, 'updateTextDocument');
    instance.sendEvent({
      type: MessageType.UI_SOQL_CHANGED,
      payload: uiModelOne
    });
    expect(
      updateDocumentSpy.callCount === 1,
      `updateDocumentSpy callcount expected 1, but got ${updateDocumentSpy.callCount
      }`
    );
    expect(
      updateDocumentSpy.getCall(0).args[1].indexOf(uiModelOne.sObject) > -1,
      `updateDocumentSpy was called with ${updateDocumentSpy.getCall(0).args[1]
      } but does not include ${uiModelOne.sObject}`
    );
  });

  it('handles activation event and updates the webview', async () => {
    const updateWebviewSpy = sandbox.spy(instance, 'updateWebview');
    instance.sendEvent({
      type: MessageType.UI_ACTIVATED
    });
    expect(
      updateWebviewSpy.callCount === 1,
      `updateWebviewSpy callcount expected 1, but got ${updateWebviewSpy.callCount
      }`
    );
  });
});

class MockTextDocumentProvider implements vscode.TextDocumentContentProvider {
  public provideTextDocumentContent(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    uri: vscode.Uri,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken
  ): string {
    return 'SELECT A FROM B';
  }
}

class TestSoqlEditorInstance extends SOQLEditorInstance {
  public sendEvent(event: SoqlEditorEvent) {
    this.onDidRecieveMessageHandler(event);
  }
  public updateWebview(document: vscode.TextDocument) {
    super.updateWebview(document);
  }

  public updateTextDocument(
    document: vscode.TextDocument,
    soql: string
  ): Thenable<boolean> {
    return super.updateTextDocument(document, soql);
  }
}
