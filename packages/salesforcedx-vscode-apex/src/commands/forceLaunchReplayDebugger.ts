/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  CommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  notificationService
} from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  testOutlineProvider
} from '../views/testOutlineProvider';
import {
  forceAnonApexDebug
} from './forceApexExecute';

export async function forceLaunchReplayDebugger() {
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

  if (fileIsAnonymousApex(sourceUri)) {
    await launchAnonymousApexReplayDebugger();
    return;
  }

  const apexTestClassName = await getApexTestClassName(sourceUri);
  if (apexTestClassName) {
    await launchApexReplayDebugger(apexTestClassName);
    return;
  }

  notificationService.showErrorMessage(
    nls.localize('command_available_for_anon_apex_or_apex_test_only')
  );
}

function fileIsAnonymousApex(sourceUri: vscode.Uri): boolean {
  const extension = sourceUri.path.split('.').pop()?.toLowerCase();
  return extension === 'apex';
}

async function getApexTestClassName(sourceUri: vscode.Uri): Promise<string | undefined> {
  if (!sourceUri) {
    return undefined;
  }

  await testOutlineProvider.refresh();
  const testClassName = testOutlineProvider.getTestClassName(sourceUri);

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
  const result = await vscode.commands.executeCommand(
    'sfdx.force.test.view.debugTests',
    {
      name: apexTestClassName
    }
  );
}

export class ForceAnonApexLaunchReplayDebuggerExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    return new CommandBuilder(nls.localize('force_launch_apex_replay_debugger_with_selected_file'))
      .withLogName('force_launch_apex_replay_debugger_with_selected_file')
      .build();
  }

  public async execute(
    // response: ContinueResponse<string>
  ): Promise<void> {
    await forceAnonApexDebug();
  }
}
