/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { updateLastOpened } from '../activation/getDialogStartingPath';
import { nls } from '../messages';
import { launchFromLogFile } from './launchFromLogFile';

export const launchApexReplayDebuggerWithCurrentFileCommand = Effect.fn(
  'ApexReplayDebugger.launchApexReplayDebuggerWithCurrentFileCommand'
)(function* (extensionContext: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('unable_to_locate_editor'));
    });
    return;
  }

  const sourceUri = editor.document.uri;
  if (!sourceUri) {
    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('unable_to_locate_document'));
    });
    return;
  }

  if (isLogFile(sourceUri)) {
    updateLastOpened(extensionContext, sourceUri);
    yield* Effect.promise(() => launchFromLogFile(sourceUri.fsPath));
    return;
  }

  if (isAnonymousApexFile(sourceUri)) {
    yield* launchAnonymousApexReplayDebugger();
    return;
  }

  const apexTestClassName = getApexTestClassName(editor.document);
  if (apexTestClassName) {
    yield* Effect.promise(() => launchApexReplayDebugger(apexTestClassName));
    return;
  }

  yield* Effect.sync(() => {
    void vscode.window.showErrorMessage(nls.localize('launch_apex_replay_debugger_unsupported_file'));
  });
});

const isLogFile = (sourceUri: URI): boolean => Utils.extname(sourceUri).toLowerCase() === '.log';

const isAnonymousApexFile = (sourceUri: URI): boolean => Utils.extname(sourceUri).toLowerCase() === '.apex';

const IS_TEST_REG_EXP = /@isTest/i;

const getApexTestClassName = (document: vscode.TextDocument): string | undefined => {
  const fileName = Utils.basename(document.uri);
  return fileName.endsWith('.cls') && IS_TEST_REG_EXP.test(document.getText())
    ? fileName.slice(0, -'.cls'.length)
    : undefined;
};

const launchAnonymousApexReplayDebugger = Effect.fn('ApexReplayDebugger.launchAnonymousApexReplayDebugger')(
  function* () {
    if (!(yield* Effect.promise(() => sfProjectPreconditionChecker.check()))) return;
    yield* Effect.promise(() => vscode.commands.executeCommand('sf.anon.apex.debug.delegate'));
  }
);

const launchApexReplayDebugger = async (apexTestClassName: string) => {
  await vscode.commands.executeCommand('sf.test.view.debugTests', {
    name: apexTestClassName
  });
};
