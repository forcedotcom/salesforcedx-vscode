/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

// ─── Shared ──────────────────────────────────────────────────────────────────

/** An action button shown in a success toast, or when a status bar success notification is clicked. */
export type ToastAction = { label: string; run: () => void | Promise<void> };

type TransientState = {
  item: vscode.StatusBarItem;
  commandDisposable: vscode.Disposable;
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
  const commandDisposable = vscode.commands.registerCommand(commandId, async () => {
    const state = transientItems.get(statusBarId);
    if (!state?.pendingToast) return;
    const { message, actions } = state.pendingToast;
    const labels = actions.map(a => a.label);
    const selection = await vscode.window.showInformationMessage(message, ...labels);
    if (selection) await actions.find(a => a.label === selection)?.run();
  });

  item.command = commandId;
  transientItems.set(statusBarId, { item, commandDisposable, timeout: undefined, pendingToast: undefined });
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

const COMMAND_LEVEL_KEY = 'commandLevelNotifications';
const EXTENSION_LEVEL_KEY = 'extensionLevelNotifications';
const GLOBAL_SECTION = 'salesforcedx-vscode-services';
const GLOBAL_KEY = 'notifications';

// ─── User-facing setting value types ─────────────────────────────────────────

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

/**
 * Notification mode for commands that have a progress phase but no success notification.
 * Two options — the success half is irrelevant.
 *
 * - `progressToast`: Show progress as a toast notification.
 * - `progressStatusBar`: Show progress spinner in the status bar.
 */
export type ProgressOnlyMode = 'progressToast' | 'progressStatusBar';

/**
 * Notification mode for commands that produce only a success notification (no progress phase).
 *
 * - `successToast`: Show the success notification as a toast.
 * - `successStatusBar`: Show the success message in the status bar.
 * - `successOff`: Suppress the success notification.
 */
export type SuccessOnlyMode = 'successToast' | 'successStatusBar' | 'successOff';

// ─── Internal normalization ───────────────────────────────────────────────────

/**
 * Normalizes any user-facing mode string to an internal `ProgressAndSuccessMode`.
 * The three mode type value sets are disjoint, so the raw string alone identifies the mode type —
 * no runtime key-type tagging needed.
 */
const normalizeToInternal = (raw: string | undefined): ProgressAndSuccessMode | undefined => {
  switch (raw) {
    // ProgressAndSuccessMode — pass through
    case 'progressToastSuccessToast':
    case 'progressToastSuccessOff':
    case 'progressStatusBarSuccessStatusBar':
    case 'progressStatusBarSuccessOff':
      return raw;
    // ProgressOnlyMode — map to equivalent with success suppressed
    case 'progressToast':
      return 'progressToastSuccessOff';
    case 'progressStatusBar':
      return 'progressStatusBarSuccessOff';
    // SuccessOnlyMode — map to equivalent with progress as toast (location irrelevant)
    case 'successToast':
      return 'progressToastSuccessToast';
    case 'successStatusBar':
      return 'progressStatusBarSuccessStatusBar';
    case 'successOff':
      return 'progressToastSuccessOff';
    default:
      return undefined;
  }
};

const getInternalMode = (
  extensionSection: string,
  commandLevelSection: string,
  command: string
): ProgressAndSuccessMode => {
  // Command-level: raw value may be any of the three mode types; normalizeToInternal handles all
  const raw = vscode.workspace.getConfiguration(commandLevelSection).inspect<string>(command);
  const cmdExplicit = raw?.workspaceFolderValue ?? raw?.workspaceValue ?? raw?.globalValue;
  const fromCmd = normalizeToInternal(cmdExplicit);
  if (fromCmd) return fromCmd;

  // Extension-level (always stores ProgressAndSuccessMode)
  const extCfg = vscode.workspace
    .getConfiguration(extensionSection)
    .inspect<ProgressAndSuccessMode>(EXTENSION_LEVEL_KEY);
  const extExplicit = extCfg?.workspaceFolderValue ?? extCfg?.workspaceValue ?? extCfg?.globalValue;
  if (extExplicit) return extExplicit;

  // Global fallback (also ProgressAndSuccessMode)
  return (
    vscode.workspace.getConfiguration(GLOBAL_SECTION).get<ProgressAndSuccessMode>(GLOBAL_KEY) ??
    'progressToastSuccessToast'
  );
};

// ─── API type ─────────────────────────────────────────────────────────────────

type NotificationModeApi<CommandKey extends string> = {
  /** Show a success notification for `command`.
   * `forceShow` overrides `*SuccessOff` modes: toast-progress modes show a toast,
   * status-bar-progress modes show in the status bar. Use only when the message
   * contains information the user must see (e.g. a request ID).
   * `actions` are shown as buttons in the toast; in status bar mode they appear when the item is clicked. */
  showSuccessNotification: (command: CommandKey, message: string, forceShow?: boolean, actions?: ToastAction[]) => void;
  getProgressLocation: (command: CommandKey) => vscode.ProgressLocation;
};

/**
 * The combined API returned by `createNotificationModeApi`.
 *
 * - `showSuccessNotification` accepts PAS + SuccessOnly keys (not ProgressOnly — no success phase).
 * - `getProgressLocation` accepts PAS + ProgressOnly keys (not SuccessOnly — no progress phase).
 * - `disposable` must be pushed to `context.subscriptions` in the extension's `activate` function to dispose the status bar item and command registration on deactivation/reload.
 */
export type CombinedNotificationModeApi<
  ProgressAndSuccessKey extends string = never,
  SuccessOnlyKey extends string = never,
  ProgressOnlyKey extends string = never
> = {
  showSuccessNotification: NotificationModeApi<ProgressAndSuccessKey | SuccessOnlyKey>['showSuccessNotification'];
  getProgressLocation: NotificationModeApi<ProgressAndSuccessKey | ProgressOnlyKey>['getProgressLocation'];
  disposable: vscode.Disposable;
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates the notification API bound to an extension's settings section and status bar item.
 *
 * Three type parameters control which keys map to which user-facing setting shape:
 * - `ProgressAndSuccessKey` — 4-option setting; `showSuccessNotification` + `getProgressLocation`
 * - `SuccessOnlyKey`        — 3-option setting (`successToast | successStatusBar | successOff`); `showSuccessNotification` only
 * - `ProgressOnlyKey`       — 2-option setting (`progressToast | progressStatusBar`); `getProgressLocation` only
 *
 * All three mode value sets are disjoint, so the factory auto-detects the mode type from the
 * raw stored setting string — no runtime key arrays needed.
 */
export const createNotificationModeApi = <
  ProgressAndSuccessKey extends string = never,
  SuccessOnlyKey extends string = never,
  ProgressOnlyKey extends string = never
>(
  extensionSection: string,
  statusBarId: string,
  statusBarName: string
): CombinedNotificationModeApi<ProgressAndSuccessKey, SuccessOnlyKey, ProgressOnlyKey> => {
  const commandLevelSection = `${extensionSection}.${COMMAND_LEVEL_KEY}`;

  return {
    showSuccessNotification: (command, message, forceShow = false, actions: ToastAction[] = []): void => {
      const mode = getInternalMode(extensionSection, commandLevelSection, command);
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
    getProgressLocation: (command): vscode.ProgressLocation => {
      const mode = getInternalMode(extensionSection, commandLevelSection, command);
      return mode === 'progressToastSuccessToast' || mode === 'progressToastSuccessOff'
        ? vscode.ProgressLocation.Notification
        : vscode.ProgressLocation.Window;
    },
    disposable: {
      dispose: () => {
        const state = transientItems.get(statusBarId);
        if (state) {
          state.commandDisposable.dispose();
          state.item.dispose();
          transientItems.delete(statusBarId);
        }
      }
    }
  };
};
