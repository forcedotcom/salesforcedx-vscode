/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from 'vscode-languageclient';
import { ApexErrorHandler } from './apexErrorHandler';
import { ProcessDetail, terminateProcess } from './languageUtils/languageServerUtils';
import { nls } from './messages';

export class ApexLanguageClient extends LanguageClient {
  private _errorHandler: ApexErrorHandler | undefined;
  public constructor(
    id: string,
    name: string,
    private serverOptions: ServerOptions,
    clientOptions: LanguageClientOptions,
    forceDebug?: boolean
  ) {
    super(id, name, serverOptions, clientOptions, forceDebug);
    this._errorHandler = clientOptions.errorHandler as ApexErrorHandler;
  }

  public get errorHandler(): ApexErrorHandler | undefined {
    return this._errorHandler;
  }

  public async stop(): Promise<void> {
    await super.stop();
  }

  public showOrphanedProcessesDialog(
    orphanedProcesses: ProcessDetail[]
  ) {
    const orphanedCount = orphanedProcesses.length;

    if (orphanedCount === 0) {
      return;
    }

    setTimeout(async () => {
      const choice = await vscode.window.showWarningMessage(
        nls.localize(
          'terminate_orphaned_language_server_instances',
          orphanedCount
        ),
        nls.localize('terminate_processes'),
        nls.localize('terminate_skip')
      );

      if (choice === nls.localize('terminate_processes')) {
        for (const processInfo of orphanedProcesses) {
          try {
            await terminateProcess(processInfo.pid);
            vscode.window.showInformationMessage(nls.localize('terminated_orphaned_process', processInfo.pid));
          } catch (err) {
            vscode.window.showErrorMessage(nls.localize('terminate_failed', processInfo.pid, err.message));
          }
        }
      }
    }, 10_000);
  }

}
