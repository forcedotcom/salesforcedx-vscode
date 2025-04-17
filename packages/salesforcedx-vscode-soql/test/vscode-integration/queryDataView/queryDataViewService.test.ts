/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import { expect } from 'chai';
import type { QueryResult } from '../../../src/types';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { getDocumentName } from '../../../src/commonUtils';
import * as commonUtils from '../../../src/commonUtils';
import { FileFormat, QueryDataFileService } from '../../../src/queryDataView/queryDataFileService';
import { QueryDataViewService } from '../../../src/queryDataView/queryDataViewService';
import { mockColumnData, mockQueryData, MockTextDocumentProvider, TestQueryDataViewService } from '../testUtilities';

describe('Query Data View Service', () => {
  let mockTextDocument: vscode.TextDocument;
  let docProviderDisposable: vscode.Disposable;
  let mockSubscription: vscode.Disposable[];
  let mockWebviewPanel: vscode.WebviewPanel;
  let sandbox: sinon.SinonSandbox;
  let queryRecords: QueryResult<JsonMap>;

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
    queryRecords = mockQueryData;
  });

  afterEach(() => {
    docProviderDisposable.dispose();
    sandbox.restore();
  });

  it('should post message to webview with query data on activation event ', () => {
    const dataViewService = new TestQueryDataViewService(mockSubscription, queryRecords, mockTextDocument);
    const postMessageSpy = sandbox.spy(mockWebviewPanel.webview, 'postMessage');

    QueryDataViewService.extensionPath = '';
    sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockWebviewPanel);
    dataViewService.createOrShowWebView();
    dataViewService.mockReceiveEvent({ type: 'activate' });

    expect(postMessageSpy.callCount).equal(1);

    const postMessageArgs = postMessageSpy.args[0][0];
    expect(postMessageArgs.data).to.eql({
      columnData: mockColumnData,
      ...mockQueryData
    });
    expect(postMessageArgs.documentName).equal(getDocumentName(mockTextDocument));
    expect(postMessageArgs.type).equal('update');
  });

  it('should save with save_records event', () => {
    const dataViewService = new TestQueryDataViewService(mockSubscription, queryRecords, mockTextDocument);
    const saveRecordsSpy = sandbox.spy(dataViewService, 'handleSaveRecords');
    const fileServiceStub = sandbox.stub(QueryDataFileService.prototype, 'save');
    QueryDataViewService.extensionPath = '';
    sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockWebviewPanel);
    dataViewService.createOrShowWebView();
    dataViewService.mockReceiveEvent({
      type: 'save_records',
      format: FileFormat.CSV
    });

    expect(saveRecordsSpy.callCount).equal(1);
    const postMessageArgs = saveRecordsSpy.args[0][0];
    expect(postMessageArgs).to.eql(FileFormat.CSV);
    expect(fileServiceStub.callCount).equal(1);
  });

  it('should track error via telemetry if event type is not handled', () => {
    const trackSpy = sandbox.spy(commonUtils, 'trackErrorWithTelemetry');
    const dataViewService = new TestQueryDataViewService(mockSubscription, queryRecords, mockTextDocument);
    dataViewService.createOrShowWebView();
    dataViewService.mockReceiveEvent({
      type: 'unsupported',
      format: FileFormat.CSV
    });
    expect(trackSpy.callCount).to.equal(1);
  });

  it('should display error when save fails', () => {
    const trackSpy = sandbox.spy(commonUtils, 'trackErrorWithTelemetry');
    const dataViewService = new TestQueryDataViewService(mockSubscription, queryRecords, mockTextDocument);
    const fileServiceStub = sandbox.stub(QueryDataFileService.prototype, 'save').throws();
    QueryDataViewService.extensionPath = '';
    sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockWebviewPanel);
    dataViewService.createOrShowWebView();
    dataViewService.mockReceiveEvent({
      type: 'save_records',
      format: FileFormat.CSV
    });
    expect(fileServiceStub.callCount).equal(1);
    expect(trackSpy.callCount).to.equal(1);
  });
});
