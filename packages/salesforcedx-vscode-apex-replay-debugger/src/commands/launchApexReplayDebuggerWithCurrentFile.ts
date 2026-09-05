/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { basename } from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { updateLastOpened } from '../activation/getDialogStartingPath';
import { nls } from '../messages';
import { launchFromLogFile } from './launchFromLogFile';

export const launchApexReplayDebuggerWithCurrentFile = async (extensionContext: vscode.ExtensionContext) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showErrorMessage(nls.localize('unable_to_locate_editor'));
    return;
  }

  const sourceUri = editor.document.uri;
  if (!sourceUri) {
    void vscode.window.showErrorMessage(nls.localize('unable_to_locate_document'));
    return;
  }

  if (isLogFile(sourceUri)) {
    updateLastOpened(extensionContext, sourceUri);
    await launchFromLogFile(sourceUri.fsPath);
    return;
  }

  if (isAnonymousApexFile(sourceUri)) {
    await launchAnonymousApexReplayDebugger();
    return;
  }

  const apexTestClassName = getApexTestClassName(editor.document);
  if (apexTestClassName) {
    await launchApexReplayDebugger(apexTestClassName);
    return;
  }

  void vscode.window.showErrorMessage(nls.localize('launch_apex_replay_debugger_unsupported_file'));
};

const isLogFile = (sourceUri: URI): boolean => Utils.extname(sourceUri).toLowerCase() === '.log';

const isAnonymousApexFile = (sourceUri: URI): boolean => Utils.extname(sourceUri).toLowerCase() === '.apex';

const IS_TEST_REG_EXP = /@isTest/i;

const getApexTestClassName = (document: vscode.TextDocument): string | undefined =>
  document.uri.fsPath.endsWith('.cls') && IS_TEST_REG_EXP.test(document.getText())
    ? basename(document.uri.fsPath, '.cls')
    : undefined;

const launchAnonymousApexReplayDebugger = async () => {
  if (!(await sfProjectPreconditionChecker.check())) return;
  await vscode.commands.executeCommand('sf.anon.apex.debug.delegate');
};

const launchApexReplayDebugger = async (apexTestClassName: string) => {
  await vscode.commands.executeCommand('sf.test.view.debugTests', {
    name: apexTestClassName
  });
};
