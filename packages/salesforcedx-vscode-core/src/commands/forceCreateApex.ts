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

function getDirs(srcPath: string) {
  const result = fs
    .readdirSync(srcPath)
    .map(function(name) {
      const x = path.join(srcPath, name);
    })
    .filter(function(source) {
      const y = fs.lstatSync(source).isDirectory();
      return y;
    });

  return result;
}

function flatten(lists: string[][]) {
  const result = lists.reduce(function(a: string[], b: string[]) {
    return a.concat(b);
  }, []);
  return result;
}

function getDirsRecursive(srcPath: string): string[] {
  const idk = getDirs(srcPath).map(src => getDirsRecursive(src));
  return [srcPath, ...flatten(idk)];
}

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

      // input boxes for template/filename/path
      const fileNameInputOptions = <vscode.InputBoxOptions>{
        prompt: 'Please enter desired filename',
        value: selection
      };

      vscode.window.showInputBox(fileNameInputOptions).then(fileName => {
        if (!fileName || fileName === '') {
          return;
        }

        const editor = vscode.window.activeTextEditor;
        const rootPath = vscode.workspace.rootPath
          ? vscode.workspace.rootPath
          : '';
        const dirs = getDirsRecursive(rootPath);
        let directoryName;
        if (editor === undefined) {
          directoryName = '';
        } else {
          directoryName = path.relative(
            rootPath,
            path.dirname(editor.document.fileName)
          );
        }

        const dirInputOptions = <vscode.InputBoxOptions>{
          prompt:
            'Please enter desired directory (default is top level workspace directory)',
          value: directoryName
        };

        vscode.window.showInputBox(dirInputOptions).then(dirName => {
          if (dirName === undefined) {
            return;
          }
          const cancellationTokenSource = new vscode.CancellationTokenSource();
          const cancellationToken = cancellationTokenSource.token;
          const execution = new CliCommandExecutor(
            new SfdxCommandBuilder()
              .withDescription(nls.localize('force_create_apex_text'))
              .withArg('force:apex:class:create')
              .withFlag('--classname', fileName)
              .withFlag('--template', selection)
              .withFlag('--outputdir', !dirName ? '.' : dirName)
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

      // vscode.commands
      //   .executeCommand('explorer.newFile', function(x: any) {
      //     console.log(x);
      //   })
      //   .then(y => {
      //     console.log(y);
      //     const fswatcher = vscode.workspace.createFileSystemWatcher(
      //       '**',
      //       false,
      //       true,
      //       true
      //     );
      //     fswatcher.onDidCreate(e => {
      //       console.log(e);
      //       const fileName = path.basename(e.fsPath);
      //       const directoryName = path.dirname(e.fsPath);
      //       fs.rename(e.fsPath, e.fsPath + '.cls');
      //       fswatcher.dispose();

      //       const cancellationTokenSource = new vscode.CancellationTokenSource();
      //       const cancellationToken = cancellationTokenSource.token;
      //       const execution = new CliCommandExecutor(
      //         new SfdxCommandBuilder()
      //           .withDescription(nls.localize('force_create_apex_text'))
      //           .withArg('force:apex:class:create')
      //           .withFlag('--classname', fileName)
      //           .withFlag('--template', selection)
      //           .withFlag('--outputdir', directoryName)
      //           .build(),
      //         { cwd: vscode.workspace.rootPath }
      //       ).execute(cancellationToken);
      //       console.log(execution.command.toCommand());
      //       execution.stdoutSubject.subscribe(data => {
      //         console.log(data.toString());
      //       });
      //       execution.stderrSubject.subscribe(data => {
      //         console.log(data.toString());
      //       });
      //     });
      //   });
    });
}
