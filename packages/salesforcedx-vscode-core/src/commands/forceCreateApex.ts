/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// import {
//   CliCommandExecutor,
//   SfdxCommandBuilder
// } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';
import fs = require('fs');
// import { channelService } from '../channels';
// import { nls } from '../messages';
// import { notificationService } from '../notifications';
// import { CancellableStatusBar, taskViewService } from '../statuses';

export async function forceCreateApex(dir?: any) {
  console.log('create apex class extension activated');
  vscode.window
    .showQuickPick(['class', 'test class', 'exception', 'email'])
    .then(selection => {
      if (!selection) {
        return;
      }

      const inputOptions = <vscode.InputBoxOptions>{
        prompt: 'Please enter desired filename',
        value: selection
      };

      vscode.window.showInputBox(inputOptions).then(fileName => {
        const fileContents = fs.readFileSync(
          '/Users/james.sweetman/Documents/sfdx-dreamhouse-internal/README.md'
        );
        const rootpath = vscode.workspace.rootPath
          ? vscode.workspace.rootPath
          : '';
        if (fileName == undefined) {
          fileName = '';
        }
        fs.writeFile(path.join(rootpath, fileName), fileContents, function(
          err
        ) {
          if (err) {
            vscode.window.showErrorMessage(err.message);
          }
          vscode.window.showInformationMessage(fileName + ' created');
        });
      });
    });
  // const uri = vscode.Uri.parse(
  //   'file:///Users/james.sweetman/Documents/sfdx-dreamhouse-internal/README.md'
  // );
  // const position = new vscode.Position(2, 1);
  // const workspaceEdit = await vscode.commands.executeCommand(
  //   'vscode.executeDocumentRenameProvider',
  //   uri,
  //   position,
  //   'help'
  // );
}
