/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService, sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { updateLastOpened } from '../activation/getDialogStartingPath';
import { nls } from '../messages';
import { launchFromLogFile } from './launchFromLogFile';

export const launchApexReplayDebuggerWithCurrentFileCommand = Effect.fn(
  'ApexReplayDebugger.launchApexReplayDebuggerWithCurrentFileCommand'
)(
  function* (extensionContext: vscode.ExtensionContext) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const { documentUri: sourceUri, text } = yield* api.services.EditorService.getActiveEditorContext(false);

    if (isLogFile(sourceUri)) {
      updateLastOpened(extensionContext, sourceUri);
      yield* api.services.FsService.uriToPath(sourceUri).pipe(Effect.flatMap(logFile => launchFromLogFile(logFile)));
      return;
    }

    if (isAnonymousApexFile(sourceUri)) {
      yield* launchAnonymousApexReplayDebugger();
      return;
    }

    const apexTestClassName = getApexTestClassName(sourceUri, text);
    if (apexTestClassName) {
      yield* Effect.promise(() => launchApexReplayDebugger(apexTestClassName));
      return;
    }

    yield* Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('launch_apex_replay_debugger_unsupported_file'));
    });
  },
  Effect.catchTag('NoActiveEditorError', () =>
    Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('unable_to_locate_editor'));
    })
  )
);

const isLogFile = (sourceUri: URI): boolean => Utils.extname(sourceUri).toLowerCase() === '.log';

const isAnonymousApexFile = (sourceUri: URI): boolean => Utils.extname(sourceUri).toLowerCase() === '.apex';

const IS_TEST_REG_EXP = /@isTest/i;

const getApexTestClassName = (sourceUri: URI, text: string): string | undefined => {
  const fileName = Utils.basename(sourceUri);
  return fileName.endsWith('.cls') && IS_TEST_REG_EXP.test(text) ? fileName.slice(0, -'.cls'.length) : undefined;
};

const launchAnonymousApexReplayDebugger = Effect.fn('ApexReplayDebugger.launchAnonymousApexReplayDebugger')(
  function* () {
    if (!(yield* sfProjectPreconditionChecker.checkEffect)) return;
    yield* Effect.promise(() => vscode.commands.executeCommand('sf.anon.apex.debug.delegate'));
  }
);

const launchApexReplayDebugger = async (apexTestClassName: string) => {
  await vscode.commands.executeCommand('sf.test.view.debugTests', {
    name: apexTestClassName
  });
};
