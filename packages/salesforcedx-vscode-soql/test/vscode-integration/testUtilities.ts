/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
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

const soqlExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-soql'
);
const soqlExports = soqlExtension?.exports;
const { workspaceContext, channelService } = soqlExports;

export function spyChannelService(sandbox: SinonSandbox) {
  return sandbox.spy(channelService, 'appendLine');
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
export const mockColumnData = {
  objectName: 'C',
  columns: [
    { title: 'A', fieldHelper: ['A'] },
    { title: 'B', fieldHelper: ['B'] }
  ],
  subTables: []
};

export const mockDescribeGlobalResponse = {
  sobjects: [
    { name: 'Account', queryable: true },
    { name: 'User', queryable: true },
    { name: 'Z', queryable: false }
  ]
};

export const mockSObjects = [
  {
    name: 'Account',
    childRelationships: [
      {
        cascadeDelete: false,
        childSObject: 'User',
        field: 'AccountId',
        relationshipName: 'Users'
      }
    ],
    fields: [
      {
        aggregatable: false,
        name: 'Id',
        label: 'Account ID',
        custom: false,
        groupable: true,
        nillable: false,
        relationshipName: null,
        sortable: true,
        type: 'id',
        updateable: false
      },
      {
        aggregatable: true,
        custom: false,
        filterable: true,
        groupable: true,
        label: 'Account Name',
        name: 'Name',
        nameField: true,
        nillable: false,
        sortable: true,
        type: 'string',
        updateable: true
      },
      {
        aggregatable: false,
        custom: false,
        filterable: false,
        groupable: false,
        label: 'Account Description',
        name: 'Description',
        nameField: false,
        sortable: false,
        type: 'textarea',
        updateable: true
      },
      {
        aggregatable: true,
        custom: false,
        filterable: true,
        groupable: true,
        label: 'Billing City',
        name: 'BillingCity',
        nameField: false,
        nillable: true,
        sortable: true,
        type: 'string',
        updateable: true
      },
      {
        aggregatable: false,
        calculated: false,
        custom: false,
        defaultValue: false,
        filterable: true,
        groupable: true,
        label: 'Deleted',
        name: 'IsDeleted',
        nameField: false,
        nillable: false,
        sortable: true,
        type: 'boolean',
        unique: false,
        updateable: false
      },
      {
        aggregatable: false,
        calculated: false,
        custom: false,
        defaultValue: false,
        filterable: true,
        groupable: true,
        label: 'LastActivityDate',
        name: 'LastActivityDate',
        nameField: false,
        nillable: false,
        sortable: true,
        type: 'date',
        unique: false,
        updateable: false
      },
      {
        aggregatable: true,
        calculated: false,
        custom: false,
        defaultValue: false,
        filterable: true,
        groupable: false,
        label: 'CreatedDate',
        name: 'CreatedDate',
        nameField: false,
        nillable: false,
        sortable: true,
        type: 'datetime',
        unique: false,
        updateable: false
      }
    ]
  },
  {
    name: 'User',
    fields: [
      {
        aggregatable: true,
        filterable: true,
        groupable: true,
        label: 'User ID',
        name: 'Id',
        referenceTo: [],
        relationshipName: null,
        sortable: true,
        type: 'id'
      },
      {
        aggregatable: true,
        custom: false,
        filterable: true,
        groupable: true,
        label: 'User Name',
        name: 'Name',
        nameField: true,
        sortable: true,
        type: 'string',
        updateable: true
      },
      {
        aggregatable: true,
        filterable: true,
        groupable: true,
        label: 'Account ID',
        name: 'AccountId',
        referenceTo: ['Account'],
        relationshipName: 'Account',
        type: 'reference'
      },
      {
        aggregatable: false,
        calculated: false,
        custom: false,
        defaultValue: false,
        filterable: true,
        groupable: true,
        label: 'Deleted',
        name: 'IsDeleted',
        nameField: false,
        nillable: false,
        sortable: true,
        type: 'boolean',
        unique: false,
        updateable: false
      }
    ]
  },
  {
    name: 'QuickText',
    fields: [
      {
        aggregatable: false,
        defaultValue: 'Email',
        filterable: true,
        groupable: false,
        label: 'Channel',
        name: 'Channel',
        nillable: true,
        picklistValues: [
          {
            active: true,
            defaultValue: true,
            label: 'Email',
            validFor: null,
            value: 'Email'
          },
          {
            active: true,
            defaultValue: false,
            label: 'Portal',
            validFor: null,
            value: 'Portal'
          },
          {
            active: true,
            defaultValue: false,
            label: 'Phone',
            validFor: null,
            value: 'Phone'
          },
          {
            active: false,
            label: 'INACTIVE',
            value: 'INACTIVE'
          }
        ],
        sortable: false,
        type: 'multipicklist',
        unique: false,
        updateable: true
      }
    ]
  }
];
export const mockSObject = mockSObjects[0];

export function stubMockConnection(
  sandbox: SinonSandbox,
  testUserName = 'test@test.com'
) {
  const connection = getMockConnection(sandbox, testUserName);
  sandbox.stub(workspaceContext, 'getConnection').returns(connection);
  return connection;
}
export function stubFailingMockConnection(
  sandbox: SinonSandbox,
  testUserName = 'test@test.com'
) {
  const connection = getFailingMockConnection(sandbox, testUserName);
  sandbox.stub(workspaceContext, 'getConnection').returns(connection);
  return connection;
}

export function getMockConnection(
  sandbox: SinonSandbox,
  testUserName = 'test@test.com'
): Connection {
  const mockAuthInfo = new AuthInfo({
    username: 'test'
  });

  const mockConnection = ({
    authInfo: mockAuthInfo,
    describeGlobal$: (callback: (err: Error | undefined, resp: any) => void) =>
      callback(undefined, mockDescribeGlobalResponse),
    describe$: (
      name: string,
      callback: (err: Error | undefined, resp: any) => void
    ) => {
      const sobjectMetadata = mockSObjects.find(s => s.name === name);
      callback(undefined, sobjectMetadata);
    },
    query: () => Promise.resolve(mockQueryData)
  } as unknown) as Connection;

  return mockConnection;
}

export function getFailingMockConnection(
  sandbox: SinonSandbox,
  testUserName = 'test@test.com'
): Connection {
  const mockAuthInfo = { test: 'test' };
  const mockConnection = {
    authInfo: mockAuthInfo,
    describeGlobal$: (callback: (err: Error | undefined, resp: any) => void) =>
      callback(new Error('Unexpected error'), undefined),
    describe$: (
      name: string,
      callback: (err: Error | undefined, resp: any) => void
    ) => callback(new Error('Unexpected error'), undefined),
    query: () => Promise.reject(new Error('Unexpected error'))
  };
  return (mockConnection as unknown) as Connection;
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
  public mockReceiveEvent(event: SoqlEditorEvent) {
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

  public sendMessageToUi(type: string, payload: any) {
    super.sendMessageToUi(type, payload);
  }
}

export class TestQueryDataViewService extends QueryDataViewService {
  public mockReceiveEvent(event: DataViewEvent) {
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
