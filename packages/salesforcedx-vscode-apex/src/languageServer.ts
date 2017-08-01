/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as child_process from 'child_process';
import * as net from 'net';
import * as path from 'path';
import * as portFinder from 'portfinder';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  StreamInfo
} from 'vscode-languageclient';
import { APEX_LANGUAGE_SERVER_CHANNEL } from './channel';
import { nls } from './messages';
import * as requirements from './requirements';

const UBER_JAR_NAME = 'apex-jorje-lsp.jar';
const JDWP_DEBUG_PORT = 2739;
const APEX_LANGUAGE_SERVER_MAIN = 'apex.jorje.lsp.ApexLanguageServerLauncher';

declare var v8debug: any;
const DEBUG = typeof v8debug === 'object' || startedInDebugMode();

async function createServer(
  context: vscode.ExtensionContext
): Promise<StreamInfo> {
  try {
    const requirementsData = await requirements.resolveRequirements();
    return new Promise<any>((resolve, reject) => {
      portFinder.getPort((err, port) => {
        const uberJar = path.resolve(
          context.extensionPath,
          'out',
          UBER_JAR_NAME
        );
        const javaExecutable = path.resolve(
          `${requirementsData.java_home}/bin/java`
        );
        let args: string[];
        if (DEBUG) {
          args = [
            '-cp',
            uberJar,
            `-Dapex-lsp.port=${port}`,
            '-Ddebug.internal.errors=true',
            '-Ddebug.semantic.errors=false',
            '-Dtrace.protocol=false',
            `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=${JDWP_DEBUG_PORT}`,
            APEX_LANGUAGE_SERVER_MAIN
          ];
        } else {
          args = [
            '-cp',
            uberJar,
            `-Dapex-lsp.port=${port}`,
            '-Ddebug.internal.errors=true',
            '-Ddebug.semantic.errors=false',
            APEX_LANGUAGE_SERVER_MAIN
          ];
        }

        net
          .createServer(socket => {
            resolve({
              reader: socket,
              writer: socket
            });
          })
          .listen(port, () => {
            const options = {
              cwd: vscode.workspace.rootPath
            };

            const lspProcess = child_process.spawn(
              javaExecutable,
              args,
              options
            );
            console.log('PROCESS INFO');
            console.log(lspProcess);

            lspProcess.stdout.on('data', data => {
              APEX_LANGUAGE_SERVER_CHANNEL.appendLine(`${data}`);
            });
            lspProcess.stderr.on('data', data => {
              APEX_LANGUAGE_SERVER_CHANNEL.appendLine(`${data}`);
            });
            lspProcess.on('close', code => {
              APEX_LANGUAGE_SERVER_CHANNEL.appendLine(
                `${nls.localize('client_name')} exited with code: ${code}`
              );
            });
          });
      });
    });
  } catch (err) {
    vscode.window.showErrorMessage(err);
    throw err;
  }
}

function startedInDebugMode(): boolean {
  const args = (process as any).execArgv;
  if (args) {
    return args.some(
      (arg: any) => /^--debug=?/.test(arg) || /^--debug-brk=?/.test(arg)
    );
  }
  return false;
}

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export function code2ProtocolConverter(value: vscode.Uri) {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
}

function protocol2CodeConverter(value: string) {
  return vscode.Uri.parse(value);
}

export function createLanguageServer(
  context: vscode.ExtensionContext
): LanguageClient {
  const clientOptions: LanguageClientOptions = {
    // Register the server for Apex documents
    documentSelector: ['apex'],
    synchronize: {
      configurationSection: 'apex',
      fileEvents: [
        vscode.workspace.createFileSystemWatcher('**/*.cls'), // Apex classes
        vscode.workspace.createFileSystemWatcher('**/*.trigger'), // Apex triggers
        vscode.workspace.createFileSystemWatcher('**/sfdx-project.json') // SFDX workspace configuration file
      ]
    },
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    }
  };

  const client = new LanguageClient(
    'apex',
    nls.localize('client_name'),
    () => createServer(context),
    clientOptions
  );
  return client;
}
