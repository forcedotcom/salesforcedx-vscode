/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

/**
 * Notification mode for commands that have both a progress phase and a success notification.
 *
 * - `progressToastSuccessToast`: Show progress and success as toast notifications.
 * - `progressToastSuccessOff`: Show progress as a cancellable toast, but suppress the success notification.
 * - `progressStatusBarSuccessStatusBar`: Show progress spinner and success message in the status bar.
 * - `progressStatusBarSuccessOff`: Show progress spinner in the status bar, but suppress the success notification.
 */
export type ProgressAndSuccessMode =
  | 'progressToastSuccessToast'
  | 'progressToastSuccessOff'
  | 'progressStatusBarSuccessStatusBar'
  | 'progressStatusBarSuccessOff';

/** An action button shown in a success toast, or when a status bar success notification is clicked. */
export type ToastAction = { label: string; run: () => void | Promise<void> };

type TransientState = {
  item: vscode.StatusBarItem;
  timeout: ReturnType<typeof setTimeout> | undefined;
  pendingToast: { message: string; actions: ToastAction[] } | undefined;
};

const transientItems = new Map<string, TransientState>();

const getTransientStatusBar = (statusBarId: string, statusBarName: string): vscode.StatusBarItem => {
  const existing = transientItems.get(statusBarId);
  if (existing) return existing.item;

  const item = vscode.window.createStatusBarItem(statusBarId, vscode.StatusBarAlignment.Left, 44);
  item.name = statusBarName;

  const commandId = `${statusBarId}.showToast`;
  vscode.commands.registerCommand(commandId, async () => {
    const state = transientItems.get(statusBarId);
    if (!state?.pendingToast) return;
    const { message, actions } = state.pendingToast;
    const labels = actions.map(a => a.label);
    const selection = await vscode.window.showInformationMessage(message, ...labels);
    if (selection) await actions.find(a => a.label === selection)?.run();
  });

  item.command = commandId;
  transientItems.set(statusBarId, { item, timeout: undefined, pendingToast: undefined });
  return item;
};

const showTransientStatusBarMessage = (
  statusBarId: string,
  statusBarName: string,
  message: string,
  actions: ToastAction[] = []
): void => {
  const item = getTransientStatusBar(statusBarId, statusBarName);
  item.text = `$(check) ${message}`;
  item.show();
  const state = transientItems.get(statusBarId)!;
  state.pendingToast = { message, actions };
  if (state.timeout) clearTimeout(state.timeout);
  state.timeout = setTimeout(() => {
    item.hide();
    state.timeout = undefined;
  }, 5000);
};

export type CombinedNotificationModeApi<
  ProgressAndSuccessKey extends string,
  SuccessOnlyKey extends string
> = ProgressAndSuccessNotificationModeApi<ProgressAndSuccessKey> & SuccessOnlyNotificationModeApi<SuccessOnlyKey>;

/**
 * Creates both notification APIs bound to the same extension settings section and status bar item.
 * Use this when an extension has commands of both types to avoid repeating the three config arguments.
 */
export const createNotificationModeApi = <ProgressAndSuccessKey extends string, SuccessOnlyKey extends string>(
  extensionSection: string,
  statusBarId: string,
  statusBarName: string
): CombinedNotificationModeApi<ProgressAndSuccessKey, SuccessOnlyKey> => ({
  ...createProgressAndSuccessNotificationMode<ProgressAndSuccessKey>(extensionSection, statusBarId, statusBarName),
  ...createSuccessOnlyNotificationMode<SuccessOnlyKey>(extensionSection, statusBarId, statusBarName)
});

/**
 * Notification mode for commands that produce only a success notification (no progress phase).
 *
 * - `toast`: Show the success notification as a toast.
 * - `statusBar`: Show the success message in the status bar.
 * - `off`: Suppress the success notification.
 */
export type SuccessOnlyMode = 'toast' | 'statusBar' | 'off';

export type SuccessOnlyNotificationModeApi<CommandKey extends string> = {
  showSuccessOnlyNotification: (command: CommandKey, message: string, actions?: ToastAction[]) => void;
};

/**
 * Creates a success-only notification API for commands that have no progress phase.
 * Reads the command-level `SuccessOnlyMode` setting; defaults to `toast` if unset.
 */
export const createSuccessOnlyNotificationMode = <CommandKey extends string>(
  extensionSection: string,
  statusBarId: string,
  statusBarName: string
): SuccessOnlyNotificationModeApi<CommandKey> => {
  const commandLevelSection = `${extensionSection}.${COMMAND_LEVEL_KEY}`;

  const getMode = (command: CommandKey): SuccessOnlyMode => {
    const i = vscode.workspace.getConfiguration(commandLevelSection).inspect<SuccessOnlyMode>(command);
    return i?.workspaceFolderValue ?? i?.workspaceValue ?? i?.globalValue ?? 'toast';
  };

  return {
    showSuccessOnlyNotification: (command: CommandKey, message: string, actions: ToastAction[] = []): void => {
      const mode = getMode(command);
      if (mode === 'statusBar') {
        showTransientStatusBarMessage(statusBarId, statusBarName, message, actions);
      } else if (mode === 'toast') {
        const labels = actions.map(a => a.label);
        void vscode.window.showInformationMessage(message, ...labels).then(selection => {
          if (selection) void actions.find(a => a.label === selection)?.run();
        });
      }
    }
  };
};

export type ProgressAndSuccessNotificationModeApi<CommandKey extends string> = {
  /** Show a success notification for `command`.
   * `forceShow` overrides `*SuccessOff` modes: toast-progress modes show a toast,
   * status-bar-progress modes show in the status bar. Use only when the message
   * contains information the user must see (e.g. a request ID).
   * `actions` are shown as buttons in the toast; in status bar mode they appear when the item is clicked. */
  showSuccessNotification: (command: CommandKey, message: string, forceShow?: boolean, actions?: ToastAction[]) => void;
  getProgressLocation: (command: CommandKey) => vscode.ProgressLocation;
};

const COMMAND_LEVEL_KEY = 'commandLevelNotifications';
const EXTENSION_LEVEL_KEY = 'extensionLevelNotifications';
const GLOBAL_SECTION = 'salesforcedx-vscode-services';
const GLOBAL_KEY = 'notifications';

const inspectExplicit = (section: string, key: string): ProgressAndSuccessMode | undefined => {
  const i = vscode.workspace.getConfiguration(section).inspect<ProgressAndSuccessMode>(key);
  return i?.workspaceFolderValue ?? i?.workspaceValue ?? i?.globalValue;
};

/**
 * Creates a notification mode API bound to a specific extension's settings sections.
 *
 * @param extensionSection - VS Code config section for the extension (e.g. 'salesforcedx-vscode-metadata')
 * @param statusBarId - Unique VS Code status bar item ID
 * @param statusBarName - Human-readable status bar item name
 */
export const createProgressAndSuccessNotificationMode = <CommandKey extends string>(
  extensionSection: string,
  statusBarId: string,
  statusBarName: string
): ProgressAndSuccessNotificationModeApi<CommandKey> => {
  const commandLevelSection = `${extensionSection}.${COMMAND_LEVEL_KEY}`;

  const getProgressAndSuccessMode = (command: CommandKey): ProgressAndSuccessMode =>
    inspectExplicit(commandLevelSection, command) ??
    inspectExplicit(extensionSection, EXTENSION_LEVEL_KEY) ??
    vscode.workspace
      .getConfiguration(GLOBAL_SECTION)
      .get<ProgressAndSuccessMode>(GLOBAL_KEY, 'progressToastSuccessToast');

  return {
    showSuccessNotification: (
      command: CommandKey,
      message: string,
      forceShow = false,
      actions: ToastAction[] = []
    ): void => {
      const mode = getProgressAndSuccessMode(command);
      const effectiveMode =
        forceShow && mode === 'progressToastSuccessOff'
          ? 'progressToastSuccessToast'
          : forceShow && mode === 'progressStatusBarSuccessOff'
            ? 'progressStatusBarSuccessStatusBar'
            : mode;
      if (effectiveMode === 'progressStatusBarSuccessStatusBar') {
        showTransientStatusBarMessage(statusBarId, statusBarName, message, actions);
      } else if (effectiveMode === 'progressToastSuccessToast') {
        const labels = actions.map(a => a.label);
        void vscode.window.showInformationMessage(message, ...labels).then(selection => {
          if (selection) void actions.find(a => a.label === selection)?.run();
        });
      }
    },
    getProgressLocation: (command: CommandKey): vscode.ProgressLocation => {
      const mode = getProgressAndSuccessMode(command);
      return mode === 'progressToastSuccessToast' || mode === 'progressToastSuccessOff'
        ? vscode.ProgressLocation.Notification
        : vscode.ProgressLocation.Window;
    }
  };
};
