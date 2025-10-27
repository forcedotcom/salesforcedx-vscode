/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { CancelResponse, ContinueResponse, ParametersGatherer } from '../types';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { nls } from '../messages';

export const CONTINUE = 'CONTINUE';
export const CANCEL = 'CANCEL';

export type FileSelection = { file: string };

export type FlagParameter<T> = {
  flag?: T;
};

/** Allows users to select a file matching a glob pattern */
export class FileSelector implements ParametersGatherer<FileSelection> {
  private readonly displayMessage: string;
  private readonly errorMessage: string;
  private readonly include: string;
  private readonly exclude?: string;
  private readonly maxResults?: number;

  constructor(displayMessage: string, errorMessage: string, include: string, exclude?: string, maxResults?: number) {
    this.displayMessage = displayMessage;
    this.errorMessage = errorMessage;
    this.include = include;
    this.exclude = exclude;
    this.maxResults = maxResults;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<FileSelection>> {
    const files = await vscode.workspace.findFiles(this.include, this.exclude, this.maxResults);
    const fileItems = files.map((file: { toString: () => string; fsPath: any }) => ({
      label: path.basename(file.toString()),
      description: file.fsPath
    }));
    if (fileItems.length === 0) {
      vscode.window.showErrorMessage(this.errorMessage);
      return { type: CANCEL };
    }
    const selection = await vscode.window.showQuickPick(fileItems, {
      placeHolder: this.displayMessage
    });
    return selection ? { type: CONTINUE, data: { file: selection.description.toString() } } : { type: CANCEL };
  }
}

export class CompositeParametersGatherer<T> implements ParametersGatherer<T> {
  private readonly gatherers: ParametersGatherer<any>[];
  constructor(...gatherers: ParametersGatherer<any>[]) {
    this.gatherers = gatherers;
  }
  public async gather(): Promise<CancelResponse | ContinueResponse<T>> {
    const aggregatedData: any = {};
    for (const gatherer of this.gatherers) {
      const input = await gatherer.gather();
      if (input.type === 'CONTINUE') {
        Object.keys(input.data).map(key => (aggregatedData[key] = input.data[key]));
      } else {
        return {
          type: 'CANCEL'
        };
      }
    }
    return {
      type: 'CONTINUE',
      data: aggregatedData
    };
  }
}

export class EmptyParametersGatherer implements ParametersGatherer<{}> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
    return { type: 'CONTINUE', data: {} };
  }
}

/** Prompts the user to confirm an action with Continue/Cancel options */
export class PromptConfirmGatherer implements ParametersGatherer<{ choice: string }> {
  private question: string;

  constructor(question: string) {
    this.question = question;
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<{ choice: string }>> {
    const confirmOpt = 'Continue';
    const cancelOpt = 'Cancel';
    const choice = await this.showMenu([cancelOpt, confirmOpt]);
    return confirmOpt === choice ? { type: CONTINUE, data: { choice } } : { type: CANCEL };
  }

  public async showMenu(options: string[]): Promise<string | undefined> {
    return await vscode.window.showQuickPick(options, {
      placeHolder: this.question
    } satisfies vscode.QuickPickOptions);
  }
}

/** Prompts the user to enter a username */
export class SelectUsername implements ParametersGatherer<{ username: string }> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{ username: string }>> {
    const usernameInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('parameter_gatherer_enter_username_name')
    } satisfies vscode.InputBoxOptions;
    const username = await vscode.window.showInputBox(usernameInputOptions);
    return username ? { type: CONTINUE, data: { username } } : { type: CANCEL };
  }
}
