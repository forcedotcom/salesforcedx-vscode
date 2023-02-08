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
  notificationService,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { testOutlineProvider } from '../views/testOutlineProvider';
import { forceAnonApexDebug } from './forceAnonApexExecute';

export async function forceLaunchApexReplayDebuggerWithCurrentFile() {
  try {
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
  } catch (error) {
    notificationService.showErrorMessage(
      nls.localize('unknown_error_when_launching_apex_replay_debugger')
    );

    channelService.showChannelOutput();
    const message = (error && error.message)
      ? error.message
      : JSON.stringify(error);
    channelService.appendLine(message);
  }
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

  const filePath = sourceUri.toString();
  // filePath is in the format of "file:///Users/{user-name}/{path-to-apex-file.cls}"

  const testClassName = testOutlineProvider.getTestClassName(filePath);

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
