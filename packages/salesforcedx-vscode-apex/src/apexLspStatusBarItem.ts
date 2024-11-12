/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from './messages';

export default class ApexLSPStatusBarItem implements vscode.Disposable {
  private languageStatusItem: vscode.LanguageStatusItem;
  private diagnostics: vscode.DiagnosticCollection;

  constructor() {
    this.languageStatusItem = vscode.languages.createLanguageStatusItem('ApexLSPLanguageStatusItem', {
      language: 'apex',
      scheme: 'file'
    });
    this.diagnostics = vscode.languages.createDiagnosticCollection('apex');
    this.indexing();
  }

  public indexing() {
    this.languageStatusItem.text = nls.localize('apex_language_server_loading');
    this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
  }

  public ready() {
    this.languageStatusItem.text = nls.localize('apex_language_server_loaded');
    this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
    // clear any errors that were there
    this.diagnostics.set(vscode.Uri.file('/ApexLSP'), []);
  }

  public error(msg: string) {
    this.languageStatusItem.text = msg;
    this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Error;
    const position = new vscode.Position(0, 0);
    this.diagnostics.set(vscode.Uri.file('/ApexLSP'), [
      new vscode.Diagnostic(new vscode.Range(position, position), msg, vscode.DiagnosticSeverity.Error)
    ]);
    // TODO W- add 'command' to statusItem to allow action to be taken
  }

  public dispose() {
    this.languageStatusItem.dispose();
  }
}
