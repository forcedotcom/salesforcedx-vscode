/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  LanguageClientOptions
} from 'vscode-languageclient';
import { LanguageClient, ServerOptions } from 'vscode-languageclient/node';
import { ApexErrorHandler } from './apexErrorHandler';
import { channelService } from './channels';
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

  public async showOrphanedProcessesDialog(orphanedProcesses: ProcessDetail[]) {
    const orphanedCount = orphanedProcesses.length;

    if (orphanedCount === 0) {
      return;
    }

    let choice: string | undefined = nls.localize('terminate_show_processes');
    do {
      choice = await vscode.window.showWarningMessage(
        nls.localize(
          'terminate_orphaned_language_server_instances',
          orphanedCount
        ),
        nls.localize('terminate_processes'),
        nls.localize('terminate_show_processes')
      ) ?? 'dismissed';

      if (choice === nls.localize('terminate_processes') && await terminationConfirmation(orphanedCount)) {
        for (const processInfo of orphanedProcesses) {
          try {
            await terminateProcess(processInfo.pid);
            channelService.appendLine(nls.localize('terminated_orphaned_process', processInfo.pid));
          } catch (err) {
            channelService.appendLine(nls.localize('terminate_failed', processInfo.pid, err.message));
          }
        }
      } else if (choice === nls.localize('terminate_show_processes')) {
        const processId: string = nls.localize('process_id');
        const parentProcessId: string = nls.localize('parent_process_id');
        const processCommand: string = nls.localize('process_command');
        const title = `${processId} ${parentProcessId} ${processCommand}`;
        const titleUnderline = `${'='.repeat(processId.length)} ${'='.repeat(parentProcessId.length)} ${'='.repeat(processCommand.length)}`;
        const processList = orphanedProcesses.map(processInfo => {
          return `${processInfo.pid.toString().padStart(processId.length)} ${processInfo.ppid.toString().padStart(parentProcessId.length)} ${processInfo.command}`;
        });
        channelService.showChannelOutput();
        channelService.appendLine([nls.localize('orphan_process_advice'), '', title, titleUnderline, ...processList].join('\n'));
      }
    } while (!choice || choice === nls.localize('terminate_show_processes'));
  }
}

async function terminationConfirmation(orphanedCount: number): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    nls.localize(
      'terminate_processes_confirm',
      orphanedCount
    ),
    nls.localize('yes'),
    nls.localize('cancel')
  );
  return choice === nls.localize('yes');
}
