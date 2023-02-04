/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  CommandBuilder,
  EmptyParametersGatherer,
  fileExtensionsMatch,
  fileUtils,
  notificationService,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { testOutlineProvider } from '../views/testOutlineProvider';
import { forceAnonApexDebug } from './forceAnonApexExecute';

export async function forceLaunchApexReplayDebuggerWithCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    notificationService.showErrorMessage(
      nls.localize('unable_to_locate_editor')
    );
    return;
  }

  const sourceUri = editor.document.uri;
  if (!sourceUri) {
    notificationService.showErrorMessage(
      nls.localize('unable_to_locate_document')
    );
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

  notificationService.showErrorMessage(
    nls.localize('launch_apex_replay_debugger_unsupported_file')
  );
}

function isLogFile(sourceUri: vscode.Uri): boolean {
  return fileExtensionsMatch(sourceUri, 'log');
}

function isAnonymousApexFile(sourceUri: vscode.Uri): boolean {
  return fileExtensionsMatch(sourceUri, 'apex');
}

async function launchReplayDebuggerLogFile(sourceUri: vscode.Uri) {
  await vscode.commands.executeCommand('sfdx.launch.replay.debugger.logfile', {
    fsPath: sourceUri.fsPath
  });
}

async function getApexTestClassName(
  sourceUri: vscode.Uri
): Promise<string | undefined> {
  if (!sourceUri) {
    return undefined;
  }

  await testOutlineProvider.refresh();
  const testClassName = testOutlineProvider.getTestClassName(sourceUri);
  // This is a little bizarre.  Intellisense is reporting that getTestClassName() returns a string,
  // but it actually it returns string | undefined.  Well, regardless, since flushFilePath() takes
  // a string (and guards against empty strings) using the Non-null assertion operator
  // (https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator)
  // fixes the issue.
  // cico
  // testClassName = fileUtils.flushFilePath(testClassName || '');

  return testClassName;
}

async function launchAnonymousApexReplayDebugger() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new ForceAnonApexLaunchReplayDebuggerExecutor()
  );
  await commandlet.run();
}

async function launchApexReplayDebugger(apexTestClassName: string) {
  // Launch using QuickLaunch (the same way the "Debug All Tests" code lens runs)
  await vscode.commands.executeCommand('sfdx.force.test.view.debugTests', {
    name: apexTestClassName
  });
}

export class ForceAnonApexLaunchReplayDebuggerExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    return new CommandBuilder(
      nls.localize('force_launch_apex_replay_debugger_with_selected_file')
    )
      .withLogName('force_launch_apex_replay_debugger_with_selected_file')
      .build();
  }

  public async execute(): Promise<void> {
    await forceAnonApexDebug();
  }
}
