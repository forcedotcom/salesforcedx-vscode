/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';
import * as vscode from 'vscode';
import {
  SoqlEditorEvent,
  SOQLEditorInstance
} from '../../src/editor/soqlEditorInstance';

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

export class MockTextDocumentProvider
  implements vscode.TextDocumentContentProvider {
  public provideTextDocumentContent(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    uri: vscode.Uri,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
