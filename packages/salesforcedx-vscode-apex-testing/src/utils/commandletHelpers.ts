/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { notificationService } from './notificationHelpers';

/** Gets the file system path from a URI, using fsPath for file:// scheme and path for other schemes (e.g., memfs://) */
export const getUriPath = (uri: URI): string => (uri.scheme === 'file' ? uri.fsPath : uri.path);

export type ContinueResponse<T> = { type: 'CONTINUE'; data: T };
export type CancelResponse = { type: 'CANCEL'; msg?: string };
export type Response<T> = ContinueResponse<T> | CancelResponse;

export type ParametersGatherer<T> = {
  gather: () => Promise<Response<T>>;
};

type PreconditionChecker = {
  check: () => Promise<boolean>;
};

type CommandletExecutor<T> = {
  execute: (response: ContinueResponse<T>) => Promise<void> | void;
};

export class EmptyParametersGatherer implements ParametersGatherer<{}> {
  // eslint-disable-next-line class-methods-use-this
  public async gather(): Promise<Response<{}>> {
    return { type: 'CONTINUE', data: {} };
  }
}

export class SfCommandlet<T> {
  private readonly prechecker: PreconditionChecker;
  private readonly gatherer: ParametersGatherer<T>;
  private readonly executor: CommandletExecutor<T>;

  constructor(checker: PreconditionChecker, gatherer: ParametersGatherer<T>, executor: CommandletExecutor<T>) {
    this.prechecker = checker;
    this.gatherer = gatherer;
    this.executor = executor;
  }

  /** Returns true if the executor ran (user continued), false if precheck failed or user cancelled. */
  public async run(): Promise<boolean> {
    if (!(await this.prechecker.check())) {
      return false;
    }
    const inputs = await this.gatherer.gather();
    if (inputs.type === 'CONTINUE') {
      await this.executor.execute(inputs);
      return true;
    }
    if (inputs.msg) {
      void notificationService.showErrorMessage(inputs.msg);
    }
    return false;
  }
}

export abstract class LibraryCommandletExecutor<T> implements CommandletExecutor<T> {
  protected cancellable: boolean = false;
  private cancelled: boolean = false;
  protected readonly executionName: string;
  protected readonly logName: string;
  protected readonly outputChannel: vscode.OutputChannel;
  protected showChannelOutput = true;

  constructor(executionName: string, logName: string, outputChannel: vscode.OutputChannel) {
    this.executionName = executionName;
    this.logName = logName;
    this.outputChannel = outputChannel;
  }

  public abstract run(
    response?: ContinueResponse<T>,
    progress?: vscode.Progress<{ message?: string }>,
    token?: vscode.CancellationToken
  ): Promise<boolean>;

  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`Starting ${this.executionName} at ${startTime}`);

    try {
      const success = await vscode.window.withProgress(
        {
          title: this.executionName,
          location: vscode.ProgressLocation.Notification,
          cancellable: this.cancellable
        },
        (progress, token) => {
          token.onCancellationRequested(() => {
            this.cancelled = true;
          });
          return this.run(response, progress, token);
        }
      );

      const endTime = new Date().toLocaleTimeString();
      this.outputChannel.appendLine(`Ended ${this.executionName} at ${endTime}`);

      if (this.showChannelOutput) {
        this.outputChannel.show();
      }

      if (!this.cancelled) {
        if (success) {
          notificationService.showSuccessfulExecution(this.executionName);
        } else {
          notificationService.showFailedExecution(this.executionName);
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        notificationService.showFailedExecution(this.executionName);
        this.outputChannel.appendLine(e.message);
      }
      this.outputChannel.show();
    }
  }
}
