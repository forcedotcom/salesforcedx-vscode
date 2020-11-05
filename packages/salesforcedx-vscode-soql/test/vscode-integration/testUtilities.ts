/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { DescribeGlobalResult, QueryResult } from 'jsforce';
import { SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import {
  SoqlEditorEvent,
  SOQLEditorInstance
} from '../../src/editor/soqlEditorInstance';
import { DataProvider } from '../../src/queryDataView/dataProviders';
import {
  FileFormat,
  QueryDataFileService
} from '../../src/queryDataView/queryDataFileService';
import {
  DataViewEvent,
  QueryDataViewService
} from '../../src/queryDataView/queryDataViewService';

export interface MockConnection {
  authInfo: object;
  describeGlobal$: (callback: (err: Error | undefined, resp: any) => void) => void;
  describe$: (name: string, callback: (err: Error | undefined, resp: any) => void) => void;
  query: () => Promise<QueryResult<JsonMap>>;
}

export const mockQueryText = 'SELECT A, B FROM C';
export const mockQueryData: QueryResult<JsonMap> = {
  done: true,
  totalSize: 2000,
  records: [
    {
      attributes: {
        type: 'C',
        url: ''
      },
      A: '',
      B: false
    },
    {
      attributes: {
        type: 'C',
        url: ''
      },
      A: '',
      B: false
    },
    {
      attributes: {
        type: 'C',
        url: ''
      },
      A: '',
      B: false
    }
  ]
};

export const mockDescribeGlobalResponse = {
  sobjects: [{ name: 'A' }, { name: 'B' }]
};
export const mockSObject = { name: 'A' };
export function getMockConnection(
  sandbox: SinonSandbox,
  testUserName = 'test@test.com'
) {
  const mockAuthInfo = { test: 'test' };
  const mockConnection = {
    authInfo: mockAuthInfo,
    describeGlobal$: (callback: (err: Error | undefined, resp: any) => void) => callback(undefined, mockDescribeGlobalResponse),
    describe$: (name: string, callback: (err: Error | undefined, resp: any) => void) => callback(undefined, mockSObject),
    query: () => Promise.resolve(mockQueryData)
  };

  sandbox
    .stub(AuthInfo, 'create')
    .withArgs({ username: testUserName })
    .resolves(mockAuthInfo);
  sandbox
    .stub(Connection, 'create')
    .withArgs({ authInfo: mockAuthInfo })
    .returns(mockConnection);
  return mockConnection;
}

export class MockTextDocumentProvider
  implements vscode.TextDocumentContentProvider {
  public provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): string {
    return mockQueryText;
  }
}

export class TestSoqlEditorInstance extends SOQLEditorInstance {
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

  public openQueryDataView(queryData: QueryResult<JsonMap>) {
    super.openQueryDataView(queryData);
  }
}

export class TestQueryDataViewService extends QueryDataViewService {
  public sendEvent(event: DataViewEvent) {
    this.onDidRecieveMessageHandler(event);
  }

  public createOrShowWebView() {
    return super.createOrShowWebView();
  }

  public handleSaveRecords(format: FileFormat) {
    super.handleSaveRecords(format);
  }

  public getWebViewContent() {
    return '<p>This is for you CI</p>';
  }
}

export class TestFileService extends QueryDataFileService {
  public getDataProvider(): DataProvider {
    return super.getDataProvider();
  }
}
