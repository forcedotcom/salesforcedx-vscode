/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as vscode from 'vscode';

export type ToastAction = { readonly label: string; readonly run: () => void | Promise<void> };
export type ProgressAndSuccessMode =
  | 'progressToastSuccessToast'
  | 'progressToastSuccessOff'
  | 'progressStatusBarSuccessStatusBar'
  | 'progressStatusBarSuccessOff';
export type ProgressOnlyMode = 'progressToast' | 'progressStatusBar';
export type SuccessOnlyMode = 'successToast' | 'successStatusBar' | 'successOff';

export class NotificationModeService extends Context.Service<
  NotificationModeService,
  {
    readonly showSuccessNotification: (
      command: string,
      message: string,
      forceShow?: boolean,
      actions?: readonly ToastAction[]
    ) => Effect.Effect<void>;
    readonly showErrorWithActions: (message: string, actions?: readonly ToastAction[]) => Effect.Effect<void>;
    readonly getProgressLocation: (command: string) => Effect.Effect<vscode.ProgressLocation>;
  }
>()('@salesforce/vscode-services/v2/NotificationModeService') {}
