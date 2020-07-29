/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExecuteAnonymousResponse } from '@salesforce/apex-node';
import { Connection } from '@salesforce/core';
import * as path from 'path';
import { languages, ProgressLocation, window } from 'vscode';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { handleApexLibraryDiagnostics } from '../../diagnostics';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { OrgAuthInfo } from '../../util';
import { formatExecuteResult } from './apexLibraryResultFormatter';
import { LibraryCommandletExecutor } from './libraryCommandlet';

export abstract class ApexLibraryExecutor extends LibraryCommandletExecutor<{}> {
  public static errorCollection = languages.createDiagnosticCollection(
    'apex-errors'
  );

  public abstract createService(conn: Connection): void;

  public async build(
    execName: string,
    telemetryLogName: string
  ): Promise<void> {
    this.executionName = execName;
    this.telemetryName = telemetryLogName;

    const usernameOrAlias = await OrgAuthInfo.getDefaultUsernameOrAlias(true);
    if (!usernameOrAlias) {
      throw new Error(nls.localize('error_no_default_username'));
    }
    const conn = await OrgAuthInfo.getConnection(usernameOrAlias);
    this.createService(conn);
  }

  public executeWrapper(
    fn: (...args: any[]) => Promise<ExecuteAnonymousResponse>
  ) {
    const commandName = this.executionName;

    return async function(...args: any[]): Promise<ExecuteAnonymousResponse> {
      channelService.showCommandWithTimestamp(`Starting ${commandName}`);

      const result = await window.withProgress(
        {
          title: commandName,
          location: ProgressLocation.Notification
        },
        async () => {
          // @ts-ignore
          return (await fn.call(this, ...args)) as ExecuteAnonymousResponse;
        }
      );

      const formattedResult = formatExecuteResult(result);
      channelService.appendLine(formattedResult);
      channelService.showCommandWithTimestamp(`Finished ${commandName}`);

      if (result.result.compiled && result.result.success) {
        ApexLibraryExecutor.errorCollection.clear();
        await notificationService.showSuccessfulExecution(commandName);
      } else {
        const editor = window.activeTextEditor;
        const document = editor!.document;
        const filePath = args[0].apexFilePath || document.uri.fsPath;

        handleApexLibraryDiagnostics(
          result,
          ApexLibraryExecutor.errorCollection,
          filePath
        );
        notificationService.showFailedExecution(commandName);
      }

      return result;
    };
  }

  public getLogsWrapper(fn: (...args: any[]) => Promise<string[]>) {
    const commandName = this.executionName;

    return async function(...args: any[]): Promise<string[]> {
      channelService.showCommandWithTimestamp(`Starting ${commandName}`);

      const result = await vscode.window.withProgress(
        {
          title: commandName,
          location: vscode.ProgressLocation.Notification
        },
        async () => {
          // @ts-ignore
          return (await fn.call(this, ...args)) as string[];
        }
      );

      channelService.showCommandWithTimestamp(`Finished ${commandName}`);

      const logPath = path.join(`${args[0].outputDir}`, `${args[0].logId}.log`);
      const document = await vscode.workspace.openTextDocument(logPath);
      vscode.window.showTextDocument(document);
      await notificationService.showSuccessfulExecution(commandName);
      return result;
    };
  }
}
