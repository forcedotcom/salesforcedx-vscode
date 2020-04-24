/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { Subject } from 'rxjs/Subject';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { DevServerService, ServerHandler } from '../service/devServerService';
import { DEV_SERVER_BASE_URL } from './commandConstants';
import { openBrowser, showError } from './commandUtils';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const {
  channelService,
  taskViewService,
  notificationService,
  SfdxCommandlet,
  ProgressNotification,
  EmptyParametersGatherer,
  SfdxWorkspaceChecker
} = sfdxCoreExports;
const SfdxCommandletExecutor = sfdxCoreExports.SfdxCommandletExecutor;

const logName = 'force_lightning_lwc_start';
const commandName = nls.localize(`force_lightning_lwc_start_text`);

export interface ForceLightningLwcStartOptions {
  /** whether to automatically open the browser after server start */
  openBrowser: boolean;
  /** complete url of the page to open in the browser */
  fullUrl?: string;
}

export class ForceLightningLwcStartExecutor extends SfdxCommandletExecutor<{}> {
  private readonly options: ForceLightningLwcStartOptions;

  constructor(options: ForceLightningLwcStartOptions = { openBrowser: true }) {
    super();
    this.options = options;
  }

  public build(): Command {
    return (
      new SfdxCommandBuilder()
        .withDescription(commandName)
        .withArg('force:lightning:lwc:start')
        .withLogName(logName)
        // .withJson()
        .build()
    );
  }

  public execute(response: ContinueResponse<{}>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const executor = new CliCommandExecutor(this.build(), {
      cwd: this.executionCwd,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    });
    const execution = executor.execute(cancellationToken);
    const executionName = execution.command.toString();

    const serverHandler: ServerHandler = {
      stop: async () => {
        return execution.killExecution('SIGTERM');
      }
    };
    DevServerService.instance.registerServerHandler(serverHandler);

    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();

    let serverStarted = false;

    const progress = new Subject();
    ProgressNotification.show(
      execution,
      cancellationTokenSource,
      vscode.ProgressLocation.Notification,
      progress.asObservable()
    );

    const task = taskViewService.addCommandExecution(
      execution,
      cancellationTokenSource
    );

    // listen for server startup
    execution.stdoutSubject.subscribe(async data => {
      if (!serverStarted && data && data.toString().includes('Server up')) {
        serverStarted = true;
        progress.complete();
        taskViewService.removeTask(task);
        notificationService.showSuccessfulExecution(executionName);

        if (this.options.openBrowser) {
          await openBrowser(this.options.fullUrl || DEV_SERVER_BASE_URL);
        }

        this.logMetric(execution.command.logName, startTime);
      }
    });

    execution.stderrSubject.subscribe(async data => {
      if (data && data.toString().includes('Server start up failed')) {
        this.handleErrors(cancellationToken, serverHandler, 1);
        progress.complete();
      }
    });

    execution.processExitSubject.subscribe(async exitCode => {
      this.handleErrors(cancellationToken, serverHandler, exitCode);
    });

    notificationService.reportExecutionError(
      executionName,
      execution.processErrorSubject
    );

    cancellationToken.onCancellationRequested(() => {
      notificationService.showWarningMessage(
        nls.localize('command_canceled', executionName)
      );
      this.showChannelOutput();
    });
  }

  private handleErrors(
    cancellationToken: vscode.CancellationToken,
    serverHandler: ServerHandler,
    exitCode: number | null | undefined
  ) {
    DevServerService.instance.clearServerHandler(serverHandler);
    if (!this.serverStarted && !cancellationToken.isCancellationRequested) {
      let message = nls.localize('force_lightning_lwc_start_failed');

      // TODO proper exit codes in lwc-dev-server for address in use, auth/org error, etc.
      if (exitCode === 127) {
        message = nls.localize('force_lightning_lwc_start_not_found');
      }

      showError(new Error(message), logName, commandName);
    } else if (exitCode !== undefined && exitCode !== null && exitCode > 0) {
      const message = nls.localize(
        'force_lightning_lwc_start_exited',
        exitCode
      );
      showError(new Error(message), logName, commandName);
    }
  }
}

export async function forceLightningLwcStart() {
  if (DevServerService.instance.isServerHandlerRegistered()) {
    const warningMessage = nls.localize(
      'force_lightning_lwc_start_already_running'
    );
    const openBrowserOption = nls.localize('prompt_option_open_browser');
    const restartOption = nls.localize('prompt_option_restart');
    const response = await notificationService.showWarningMessage(
      warningMessage,
      openBrowserOption,
      restartOption
    );
    if (response === openBrowserOption) {
      await openBrowser(DEV_SERVER_BASE_URL);
      return;
    } else if (response === restartOption) {
      channelService.appendLine(
        nls.localize('force_lightning_lwc_stop_in_progress')
      );
      await DevServerService.instance.stopServer();
    } else {
      console.log('local development server already running, no action taken');
      return;
    }
  }

  const preconditionChecker = new SfdxWorkspaceChecker();
  const parameterGatherer = new EmptyParametersGatherer();
  const executor = new ForceLightningLwcStartExecutor();

  const commandlet = new SfdxCommandlet(
    preconditionChecker,
    parameterGatherer,
    executor
  );

  await commandlet.run();
}
