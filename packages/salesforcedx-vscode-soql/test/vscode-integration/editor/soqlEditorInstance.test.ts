/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { SObjectService } from '@salesforce/sobject-metadata';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { MessageType } from '../../../src/editor/soqlEditorInstance';
import {
  MockTextDocumentProvider,
  TestSoqlEditorInstance
} from '../testUtilities';

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
    const sobjectNames = ['A', 'B'];
    sandbox
      .stub(SObjectService.prototype, 'retrieveSObjectNames')
      .resolves(sobjectNames);

    const expectedMessage = {
      type: 'sobjects_response',
      payload: sobjectNames
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
      .stub(SObjectService.prototype, 'describeSObject')
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
    const aQuery = 'select a,b,c from somewhere';
    const updateDocumentSpy = sandbox.spy(instance, 'updateTextDocument');
    instance.sendEvent({
      type: MessageType.UI_SOQL_CHANGED,
      payload: aQuery
    });
    expect(
      updateDocumentSpy.callCount === 1,
      `updateDocumentSpy callcount expected 1, but got ${
        updateDocumentSpy.callCount
      }`
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
      `updateWebviewSpy callcount expected 1, but got ${
        updateWebviewSpy.callCount
      }`
    );
  });
});
