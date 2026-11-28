/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ProgressAndSuccessMode, ProgressOnlyMode, SuccessOnlyMode } from '@salesforce/vscode-services/v2';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';

const AnyModeSchema = Schema.Literals([
  'progressToastSuccessToast',
  'progressToastSuccessOff',
  'progressStatusBarSuccessStatusBar',
  'progressStatusBarSuccessOff',
  'progressToast',
  'progressStatusBar',
  'successToast',
  'successStatusBar',
  'successOff'
]);
const ProgressAndSuccessModeSchema = Schema.Literals([
  'progressToastSuccessToast',
  'progressToastSuccessOff',
  'progressStatusBarSuccessStatusBar',
  'progressStatusBarSuccessOff'
]);
const normalizedModes: Record<ProgressAndSuccessMode | ProgressOnlyMode | SuccessOnlyMode, ProgressAndSuccessMode> = {
  progressToastSuccessToast: 'progressToastSuccessToast',
  progressToastSuccessOff: 'progressToastSuccessOff',
  progressStatusBarSuccessStatusBar: 'progressStatusBarSuccessStatusBar',
  progressStatusBarSuccessOff: 'progressStatusBarSuccessOff',
  progressToast: 'progressToastSuccessOff',
  progressStatusBar: 'progressStatusBarSuccessOff',
  successToast: 'progressToastSuccessToast',
  successStatusBar: 'progressStatusBarSuccessStatusBar',
  successOff: 'progressToastSuccessOff'
};
export const normalizeToInternal = (mode: keyof typeof normalizedModes): ProgressAndSuccessMode =>
  normalizedModes[mode];

/** Ignore manifest defaults for overrides; retain the most-specific explicit setting at each level. */
export const getInternalMode = (
  extensionSection: string,
  commandLevelSection: string,
  command: string
): ProgressAndSuccessMode => {
  const raw = vscode.workspace.getConfiguration(commandLevelSection).inspect<unknown>(command);
  const commandValue = raw?.workspaceFolderValue ?? raw?.workspaceValue ?? raw?.globalValue;
  const commandMode = Schema.decodeUnknownOption(AnyModeSchema)(commandValue).pipe(Option.map(normalizeToInternal));
  if (Option.isSome(commandMode)) return commandMode.value;
  const extension = vscode.workspace.getConfiguration(extensionSection).inspect<unknown>('extensionLevelNotifications');
  const extensionValue = extension?.workspaceFolderValue ?? extension?.workspaceValue ?? extension?.globalValue;
  const extensionMode = Schema.decodeUnknownOption(ProgressAndSuccessModeSchema)(extensionValue);
  if (Option.isSome(extensionMode)) return extensionMode.value;
  return Schema.decodeUnknownOption(ProgressAndSuccessModeSchema)(
    vscode.workspace.getConfiguration('salesforcedx-vscode-services').get<unknown>('notifications')
  ).pipe(Option.getOrElse(() => 'progressToastSuccessToast' as const));
};
