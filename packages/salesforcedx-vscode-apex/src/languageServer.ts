/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { Executable, LanguageClientOptions, RevealOutputChannelOn } from 'vscode-languageclient/node';
import { ApexErrorHandler } from './apexErrorHandler';
import { ApexLanguageClient } from './apexLanguageClient';
import { LSP_ERR, UBER_JAR_NAME } from './constants';
import { soqlMiddleware } from './embeddedSoql';
import { nls } from './messages';
import * as requirements from './requirements';
import { retrieveEnableApexLSErrorToTelemetry, retrieveEnableSyncInitJobs } from './settings';
import { getTelemetryService } from './telemetry/telemetry';

const JDWP_DEBUG_PORT = 2739;
const APEX_LANGUAGE_SERVER_MAIN = 'apex.jorje.lsp.ApexLanguageServerLauncher';
const SUSPEND_LANGUAGE_SERVER_STARTUP = process.env.SUSPEND_LANGUAGE_SERVER_STARTUP === 'true';
const LANGUAGE_SERVER_LOG_LEVEL = process.env.LANGUAGE_SERVER_LOG_LEVEL ?? 'ERROR';
// eslint-disable-next-line no-var
declare var v8debug: any;

const startedInDebugMode = (): boolean => {
  const args = (process as any).execArgv;
  if (args) {
    return args.some(
      (arg: any) =>
        /^--debug=?/.test(arg) || /^--debug-brk=?/.test(arg) || /^--inspect=?/.test(arg) || /^--inspect-brk=?/.test(arg)
    );
  }
  return false;
};

const DEBUG = typeof v8debug === 'object' || startedInDebugMode();

const createServer = async (extensionContext: vscode.ExtensionContext): Promise<Executable> => {
  const telemetryService = await getTelemetryService();
  try {
    const requirementsData = await requirements.resolveRequirements();
    const uberJar = path.resolve(
      extensionContext.extensionPath,
      extensionContext.extension.packageJSON.languageServerDir,
      UBER_JAR_NAME
    );
    const javaExecutable = path.resolve(`${requirementsData.java_home}/bin/java`);
    const jvmMaxHeap = requirementsData.java_memory;
    const enableSemanticErrors: boolean = vscode.workspace
      .getConfiguration()
      .get<boolean>('salesforcedx-vscode-apex.enable-semantic-errors', false);
    const enableCompletionStatistics: boolean = vscode.workspace
      .getConfiguration()
      .get<boolean>('salesforcedx-vscode-apex.advanced.enable-completion-statistics', false);

    const args: string[] = [
      '-cp',
      uberJar,
      '-Ddebug.internal.errors=true',
      `-Ddebug.semantic.errors=${enableSemanticErrors}`,
      `-Ddebug.completion.statistics=${enableCompletionStatistics}`,
      '-Dlwc.typegeneration.disabled=true'
    ];

    if (jvmMaxHeap) {
      args.push(`-Xmx${jvmMaxHeap}M`);
    }
    telemetryService.sendEventData('apexLSPSettings', undefined, {
      maxHeapSize: jvmMaxHeap != null ? jvmMaxHeap : 0
    });

    if (DEBUG) {
      args.push(
        '-Dtrace.protocol=false',
        `-Dapex.lsp.root.log.level=${LANGUAGE_SERVER_LOG_LEVEL}`,
        `-agentlib:jdwp=transport=dt_socket,server=y,suspend=${
          SUSPEND_LANGUAGE_SERVER_STARTUP ? 'y' : 'n'
        },address=*:${JDWP_DEBUG_PORT},quiet=y`
      );
      if (process.env.YOURKIT_PROFILER_AGENT) {
        if (SUSPEND_LANGUAGE_SERVER_STARTUP) {
          throw new Error('Cannot suspend language server startup with profiler agent enabled.');
        }
        args.push(`-agentpath:${process.env.YOURKIT_PROFILER_AGENT}`);
      }
    }

    args.push(APEX_LANGUAGE_SERVER_MAIN);

    return {
      options: {
        env: process.env
      },
      command: javaExecutable,
      args
    };
  } catch (err) {
    void vscode.window.showErrorMessage(err);
    telemetryService.sendException(LSP_ERR, err.error);
    throw err;
  }
};

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export const code2ProtocolConverter = (value: vscode.Uri) => {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
};

const protocol2CodeConverter = (value: string) => {
  return vscode.Uri.parse(value);
};

export const createLanguageServer = async (extensionContext: vscode.ExtensionContext): Promise<ApexLanguageClient> => {
  const telemetryService = await getTelemetryService();
  const server = await createServer(extensionContext);
  const client = new ApexLanguageClient('apex', nls.localize('client_name'), server, buildClientOptions());

  client.onTelemetry(data => telemetryService.sendEventData('apexLSPLog', data.properties, data.measures));

  return client;
};

// exported only for testing
export const buildClientOptions = (): LanguageClientOptions => {
  const soqlExtensionInstalled = isSOQLExtensionInstalled();

  return {
    // Register the server for Apex documents
    documentSelector: [
      { language: 'apex', scheme: 'file' },
      { language: 'apex-anon', scheme: 'file' }
    ],
    synchronize: {
      configurationSection: 'apex',
      fileEvents: [
        vscode.workspace.createFileSystemWatcher('**/', true, true, false), // only events for folder deletions
        vscode.workspace.createFileSystemWatcher('**/*.{cls,trigger,apex}'), // Apex classes
        vscode.workspace.createFileSystemWatcher('**/sfdx-project.json') // SFDX workspace configuration file
      ]
    },
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    },
    initializationOptions: {
      enableEmbeddedSoqlCompletion: soqlExtensionInstalled,
      enableSynchronizedInitJobs: retrieveEnableSyncInitJobs(),
      enableErrorToTelemetry: retrieveEnableApexLSErrorToTelemetry()
    },
    ...(soqlExtensionInstalled ? { middleware: soqlMiddleware } : {}),
    errorHandler: new ApexErrorHandler()
  };
};

const isSOQLExtensionInstalled = () => {
  const soqlExtensionName = 'salesforce.salesforcedx-vscode-soql';
  const soqlExtension = vscode.extensions.getExtension(soqlExtensionName);
  return soqlExtension !== undefined;
};
