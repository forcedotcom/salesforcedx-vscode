/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  notificationService,
  ProgressNotification,
  SfCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import {
  EmptyParametersGatherer,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { Subject } from 'rxjs/Subject';
import * as vscode from 'vscode';
import { channelService } from '../channel';
import { nls } from '../messages';
import { DevServerService, ServerHandler } from '../service/devServerService';
import { openBrowser, showError } from './commandUtils';

const logName = 'lightning_lwc_start';
const commandName = nls.localize('lightning_lwc_start_text');

/**
 * Hints for providing a user-friendly error message / action.
 * Hints come from the stderr output of lwc-dev-server. (We should move this to lwc-dev-server later)
 */
export const enum errorHints {
  SERVER_STARTUP_FALIED = 'Server start up failed',
  ADDRESS_IN_USE = 'EADDRINUSE',
  INACTIVE_SCRATCH_ORG = 'Error authenticating to your scratch org. Make sure that it is still active'
}

export type LightningLwcStartOptions = {
  /** whether to automatically open the browser after server start */
  openBrowser: boolean;
  /** component name to preview in the browser */
  componentName?: string;
};

export class LightningLwcStartExecutor extends SfCommandletExecutor<{}> {
  private readonly options: LightningLwcStartOptions;
  private errorHint?: string;

  constructor(options: LightningLwcStartOptions = { openBrowser: true }) {
    super();
    this.options = options;
  }

  public build(): Command {
    return (
      new SfCommandBuilder()
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
      env: { SF_JSON_TO_STDOUT: 'true' }
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
    let printedError = false;

    const progress = new Subject<number>();
    ProgressNotification.show(
      execution,
      cancellationTokenSource,
      vscode.ProgressLocation.Notification,
      progress.asObservable()
    );

    // listen for server startup
    execution.stdoutSubject.subscribe(async data => {
      if (!serverStarted && data && data.toString().includes('Server up')) {
        serverStarted = true;
        progress.complete();
        notificationService.showSuccessfulExecution(executionName, channelService).catch();

        DevServerService.instance.setBaseUrlFromDevServerUpMessage(data.toString());

        if (this.options.openBrowser) {
          await openBrowser(
            this.options.componentName
              ? DevServerService.instance.getComponentPreviewUrl(this.options.componentName)
              : DevServerService.instance.getBaseUrl()
          );
        }

        this.logMetric(execution.command.logName, startTime);
      }
    });

    execution.stderrSubject.subscribe(async data => {
      if (!printedError && data) {
        let errorCode = -1;
        if (data.toString().includes(errorHints.SERVER_STARTUP_FALIED)) {
          errorCode = 1;
        }
        if (data.toString().includes(errorHints.ADDRESS_IN_USE)) {
          errorCode = 98;
        }
        if (data.toString().includes(errorHints.INACTIVE_SCRATCH_ORG)) {
          this.errorHint = errorHints.INACTIVE_SCRATCH_ORG;
        }
        if (errorCode !== -1) {
          this.handleErrors(cancellationToken, serverHandler, serverStarted, errorCode);
          progress.complete();
          printedError = true;
        }
      }
    });

    execution.processExitSubject.subscribe(async exitCode => {
      if (!printedError) {
        this.handleErrors(cancellationToken, serverHandler, serverStarted, exitCode);
        printedError = true;
      }
    });

    notificationService.reportExecutionError(executionName, execution.processErrorSubject);

    cancellationToken.onCancellationRequested(() => {
      notificationService.showWarningMessage(nls.localize('command_canceled', executionName));
      channelService.showChannelOutput();
    });
  }

  private handleErrors(
    cancellationToken: vscode.CancellationToken,
    serverHandler: ServerHandler,
    serverStarted: boolean,
    exitCode: number | null | undefined
  ) {
    DevServerService.instance.clearServerHandler(serverHandler);
    if (!serverStarted && !cancellationToken.isCancellationRequested) {
      let message = nls.localize('lightning_lwc_start_failed');

      if (exitCode === 1 && this.errorHint === errorHints.INACTIVE_SCRATCH_ORG) {
        message = nls.localize('lightning_lwc_inactive_scratch_org');
      }
      if (exitCode === 127) {
        message = nls.localize('lightning_lwc_start_not_found');
      }
      if (exitCode === 98) {
        message = nls.localize('lightning_lwc_start_addr_in_use');
      }

      showError(new Error(message), logName, commandName);
    } else if (exitCode !== undefined && exitCode !== null && exitCode > 0) {
      const message = nls.localize('lightning_lwc_start_exited', exitCode);
      showError(new Error(message), logName, commandName);
    }
  }
}

export const lightningLwcStart = async () => {
  if (DevServerService.instance.isServerHandlerRegistered()) {
    const warningMessage = nls.localize('lightning_lwc_start_already_running');
    const openBrowserOption = nls.localize('prompt_option_open_browser');
    const restartOption = nls.localize('prompt_option_restart');
    const response = await notificationService.showWarningMessage(warningMessage, openBrowserOption, restartOption);
    if (response === openBrowserOption) {
      await openBrowser(DevServerService.instance.getBaseUrl());
      return;
    } else if (response === restartOption) {
      channelService.appendLine(nls.localize('lightning_lwc_stop_in_progress'));
      await DevServerService.instance.stopServer();
    } else {
      console.log('local development server already running, no action taken');
      return;
    }
  }

  const preconditionChecker = new SfWorkspaceChecker();
  const parameterGatherer = new EmptyParametersGatherer();
  const executor = new LightningLwcStartExecutor();

  const commandlet = new SfCommandlet(preconditionChecker, parameterGatherer, executor);

  await commandlet.run();
};
