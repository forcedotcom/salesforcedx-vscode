/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommandBuilder, Command } from '@salesforce/salesforcedx-utils';
import {
  EmptyParametersGatherer,
  fileExtensionsMatch,
  fileUtils,
  notificationService,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { getTestOutlineProvider } from '../views/testOutlineProvider';
import { anonApexDebug } from './anonApexExecute';

export const launchApexReplayDebuggerWithCurrentFile = async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void notificationService.showErrorMessage(nls.localize('unable_to_locate_editor'));
    return;
  }

  const sourceUri = editor.document.uri;
  if (!sourceUri) {
    void notificationService.showErrorMessage(nls.localize('unable_to_locate_document'));
    return;
  }

  if (isLogFile(sourceUri)) {
    await launchReplayDebuggerLogFile(sourceUri);
    return;
  }

  if (isAnonymousApexFile(sourceUri)) {
    await launchAnonymousApexReplayDebugger();
    return;
  }

  const apexTestClassName = await getApexTestClassName(sourceUri);
  if (apexTestClassName) {
    await launchApexReplayDebugger(apexTestClassName);
    return;
  }

  void notificationService.showErrorMessage(nls.localize('launch_apex_replay_debugger_unsupported_file'));
};

const isLogFile = (sourceUri: URI): boolean => fileExtensionsMatch(sourceUri, 'log');

const isAnonymousApexFile = (sourceUri: URI): boolean => fileExtensionsMatch(sourceUri, 'apex');

const launchReplayDebuggerLogFile = async (sourceUri: URI) => {
  await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile', {
    fsPath: sourceUri.fsPath
  });
};

const getApexTestClassName = async (sourceUri: URI): Promise<string | undefined> => {
  if (!sourceUri) {
    return undefined;
  }

  const testOutlineProvider = getTestOutlineProvider();
  await testOutlineProvider.refresh();
  const flushedUri = URI.file(fileUtils.flushFilePath(sourceUri.fsPath));

  return testOutlineProvider.getTestClassName(flushedUri);
};

const launchAnonymousApexReplayDebugger = async () => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new AnonApexLaunchReplayDebuggerExecutor()
  );
  await commandlet.run();
};

const launchApexReplayDebugger = async (apexTestClassName: string) => {
  // Launch using QuickLaunch (the same way the "Debug All Tests" code lens runs)
  await vscode.commands.executeCommand('sf.test.view.debugTests', {
    name: apexTestClassName
  });
};

class AnonApexLaunchReplayDebuggerExecutor extends SfCommandletExecutor<{}> {
  public build(): Command {
    return new CommandBuilder(nls.localize('launch_apex_replay_debugger_with_selected_file'))
      .withLogName('launch_apex_replay_debugger_with_selected_file')
      .build();
  }

  public async execute(): Promise<void> {
    await anonApexDebug();
  }
}
