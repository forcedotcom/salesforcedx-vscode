/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  SoqlEditorEvent,
  SOQLEditorInstance
} from '../../src/editor/soqlEditorInstance';

export class MockTextDocumentProvider
  implements vscode.TextDocumentContentProvider {
  public provideTextDocumentContent(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    uri: vscode.Uri,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken
  ): string {
    return 'SELECT A FROM B';
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
}
