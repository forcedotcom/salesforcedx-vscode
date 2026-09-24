/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from './messages';
import { getRuntime } from './services/runtime';
import { getApexLanguageServerRestartBehavior } from './settings';

export default class ApexLSPStatusBarItem implements vscode.Disposable {
  private languageStatusItem: vscode.LanguageStatusItem;
  private restartStatusItem: vscode.LanguageStatusItem;
  private diagnostics: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.languageStatusItem = vscode.languages.createLanguageStatusItem('ApexLSPLanguageStatusItem', {
      language: 'apex',
      scheme: 'file'
    });
    this.restartStatusItem = vscode.languages.createLanguageStatusItem('ApexLSPRestartStatusItem', {
      language: 'apex',
      scheme: 'file'
    });
    this.diagnostics = vscode.languages.createDiagnosticCollection('apex');

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('salesforcedx-vscode-apex.languageServer.restartBehavior')) {
          this.updateRestartCommandText();
        }
      })
    );

    this.indexing();
  }

  private updateRestartCommandText() {
    getApexLanguageServerRestartBehavior().pipe(
      Effect.tap(restartBehavior =>
        Effect.sync(() => {
          const commandTitle = Match.value(restartBehavior).pipe(
            Match.when('restart', () => nls.localize('apex_language_server_restart_dialog_restart_only')),
            Match.when('reset', () => nls.localize('apex_language_server_restart_dialog_clean_and_restart')),
            Match.orElse(() => nls.localize('apex_language_server_restart'))
          );

          this.restartStatusItem.text = commandTitle;
          this.restartStatusItem.command = {
            title: commandTitle,
            command: 'sf.apex.languageServer.restart',
            arguments: ['statusBar']
          };
        })
      ),
      getRuntime().runFork
    );
  }

  public indexing() {
    this.languageStatusItem.text = nls.localize('apex_language_server_loading');
    this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
    this.restartStatusItem.text = '';
    this.restartStatusItem.command = undefined;
  }

  public ready() {
    this.languageStatusItem.text = nls.localize('apex_language_server_loaded');
    this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
    this.languageStatusItem.command = undefined;
    this.updateRestartCommandText();
    // clear any errors that were there
    this.diagnostics.set(URI.file('/ApexLSP'), []);
  }

  public restarting() {
    this.languageStatusItem.text = nls.localize('apex_language_server_restarting');
    this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Information;
    this.restartStatusItem.text = '';
    this.restartStatusItem.command = undefined;
  }

  public error(msg: string) {
    this.languageStatusItem.text = msg;
    this.languageStatusItem.severity = vscode.LanguageStatusSeverity.Error;
    this.restartStatusItem.text = '';
    this.restartStatusItem.command = undefined;
    const position = new vscode.Position(0, 0);
    const errorSeverity = vscode.DiagnosticSeverity?.Error ?? 0;
    this.diagnostics.set(URI.file('/ApexLSP'), [
      new vscode.Diagnostic(new vscode.Range(position, position), msg, errorSeverity)
    ]);
  }

  public dispose() {
    this.languageStatusItem.dispose();
    this.restartStatusItem.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
