/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';
import fs = require('fs');
// import { channelService } from '../channels';
import { nls } from '../messages';
// import { notificationService } from '../notifications';
// import { CancellableStatusBar, taskViewService } from '../statuses';

export async function forceCreateApex(dir?: any) {
  console.log('create apex class extension activated');
  console.log('dir: ' + dir);
  vscode.window
    .showQuickPick([
      'DefaultApexClass',
      'ApexException',
      'ApexUnitTest',
      'InboundEmailService'
    ])
    .then(selection => {
      if (!selection) {
        return;
      }

      vscode.commands
        .executeCommand('explorer.newFile', function(x: any) {
          console.log(x);
        })
        .then(y => {
          console.log(y);
          const fswatcher = vscode.workspace.createFileSystemWatcher(
            '**',
            false,
            true,
            true
          );
          fswatcher.onDidCreate(e => {
            console.log(e);
            const fileName = path.basename(e.fsPath);
            const directoryName = path.dirname(e.fsPath);
            fs.unlinkSync(e.fsPath);
            fswatcher.dispose();

            const cancellationTokenSource = new vscode.CancellationTokenSource();
            const cancellationToken = cancellationTokenSource.token;
            const execution = new CliCommandExecutor(
              new SfdxCommandBuilder()
                .withDescription(nls.localize('force_create_apex_text'))
                .withArg('force:apex:class:create')
                .withFlag('--classname', fileName)
                .withFlag('--template', selection)
                .withFlag('--outputdir', directoryName)
                .build(),
              { cwd: vscode.workspace.rootPath }
            ).execute(cancellationToken);
            console.log(execution.command.toCommand());
            execution.stdoutSubject.subscribe(data => {
              console.log(data.toString());
            });
            execution.stderrSubject.subscribe(data => {
              console.log(data.toString());
            });
          });
        });
    });
}
