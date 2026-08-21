/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { extractAnonApexSource, type HeapDumpResult } from '@salesforce/salesforcedx-apex-replay-debugger';
import { errorToString } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { isString, isUndefined } from 'effect/Predicate';
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { DEBUGGER_LAUNCH_TYPE, DEBUGGER_TYPE } from '../debuggerConstants';
import { nls } from '../messages';
import { fetchHeapDumpOverlayResults } from '../services/heapDumpOverlayFetch';
import { getRuntime } from '../services/runtime';

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  private salesforceApexExtension = vscode.extensions.getExtension<ApexVSCodeApi>(
    'salesforce.salesforcedx-vscode-apex'
  );
  public static getConfig(
    logFile?: string,
    stopOnEntry: boolean = true,
    anonApexFilePath?: string,
    anonApexLineOffset?: number
  ): vscode.DebugConfiguration {
    return {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: logFile ?? '${command:AskForLogFileName}',
      stopOnEntry,
      trace: true,
      ...(anonApexFilePath ? { anonApexFilePath } : {}),
      ...(anonApexLineOffset !== undefined ? { anonApexLineOffset } : {})
    };
  }

  public provideDebugConfigurations(
    _folder: vscode.WorkspaceFolder | undefined,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [DebugConfigurationProvider.getConfig()];
  }

  public resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    return this.asyncDebugConfig(config).catch(async err =>
      vscode.window.showErrorMessage(errorToString(err), { modal: true }).then(() => undefined)
    );
  }

  private async asyncDebugConfig(config: vscode.DebugConfiguration): Promise<vscode.DebugConfiguration | undefined> {
    config.name = config.name || nls.localize('config_name_text');
    config.type = config.type || DEBUGGER_TYPE;
    config.request = config.request || DEBUGGER_LAUNCH_TYPE;
    config.logFile = config.logFile ?? '${command:AskForLogFileName}';
    if (isUndefined(config.stopOnEntry)) {
      config.stopOnEntry = true;
    }
    if (isUndefined(config.trace)) {
      config.trace = true;
    }

    if (!this.salesforceApexExtension?.isActive) {
      await this.salesforceApexExtension?.activate();
    }
    if (this.salesforceApexExtension?.exports) {
      await this.isLanguageClientReady();
      config.lineBreakpointInfo = await this.salesforceApexExtension.exports.getLineBreakpointInfo();
    }

    // Handle log file reading for web compatibility
    if (config.logFile && config.logFile !== '${command:AskForLogFileName}') {
      // Direct file path provided
      try {
        config.logFileContents = await getRuntime().runPromise(readLogFile(config.logFile));
        config.logFilePath = config.logFile;
        config.logFileName = getBasename(config.logFile);
        // Remove logFile since we're now using logFileContents
        delete config.logFile;
      } catch (error) {
        console.error('Failed to read log file:', error);
        // errorToString keeps the single-line message; interpolating the runPromise rejection would
        // paste Effect's multi-line pretty-printed cause (with stack) into the modal dialog.
        throw new Error(`Failed to read log file: ${errorToString(error)}`);
      }
    } else if (config.logFile === '${command:AskForLogFileName}') {
      // User needs to select a file
      try {
        const logFilePath = await vscode.commands.executeCommand('extension.replay-debugger.getLogFileName');
        if (logFilePath && isString(logFilePath)) {
          config.logFileContents = await getRuntime().runPromise(readLogFile(logFilePath));
          config.logFilePath = logFilePath;
          config.logFileName = getBasename(logFilePath);
          // Remove logFile since we're now using logFileContents
          delete config.logFile;
        } else {
          throw new Error('No log file selected');
        }
      } catch (error) {
        console.error('Failed to read selected log file:', error);
        throw new Error(`Failed to read selected log file: ${errorToString(error)}`);
      }
    }

    if (typeof config.logFileContents !== 'string') {
      return config;
    }
    if (config.logFileContents.includes('|HEAP_DUMP|')) {
      config.heapDumpResults = await resolveHeapDumpResults(config.logFileContents);
    }
    if (!config.anonApexFilePath) {
      await resolveAnonApexFilePath(config);
    }

    return config;
  }

  private async isLanguageClientReady(): Promise<void> {
    if (!this.salesforceApexExtension?.exports) {
      throw new Error('Apex extension not available');
    }

    let expired = false;
    let i = 0;
    while (!this.salesforceApexExtension.exports.languageClientManager.getStatus().isReady() && !expired) {
      if (this.salesforceApexExtension.exports.languageClientManager.getStatus().failedToInitialize()) {
        throw Error(this.salesforceApexExtension.exports.languageClientManager.getStatus().getStatusMessage());
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      if (i >= 30) {
        expired = true;
      }
      i++;
    }
    if (expired) {
      throw new Error(nls.localize('language_client_not_ready'));
    }
  }
}

/**
 * Reads a log file through FsService so desktop and web (virtual fs) both work.
 * Fails with FsServiceError; the promise-based callers keep their own error handling.
 */
const readLogFile = Effect.fn('ApexReplayDebugger.readLogFile')(function* (filePath: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.FsService.readFile(filePath);
});

/**
 * Resolves the target-org connection and batch-fetches overlay results for every heap dump in the log.
 * Non-fatal: an org-resolution/fetch failure attaches a single error marker so the adapter surfaces it,
 * matching prior behavior where a failed fetch still launches the session.
 */
const resolveHeapDumpResults = (logFileContents: string): Promise<HeapDumpResult[]> => {
  // Org/connection resolution failures keep the localized org-info label; a HeapDumpOverlayFetchError
  // is a batch-request failure, so it surfaces its own message rather than being mislabeled as org-info.
  const orgInfoError = (error: unknown): Effect.Effect<HeapDumpResult[]> =>
    Effect.succeed([
      { heapDumpId: '', error: `${nls.localize('unable_to_retrieve_org_info')} : ${errorToString(error)}` }
    ]);
  return fetchHeapDumpOverlayResults(logFileContents).pipe(
    Effect.catchTag('HeapDumpOverlayFetchError', error =>
      Effect.succeed<HeapDumpResult[]>([{ heapDumpId: '', error: errorToString(error) }])
    ),
    // Everything else (org/connection resolution failures) keeps the localized org-info label.
    Effect.catchAll(orgInfoError),
    getRuntime().runPromise
  );
};

// Helper function to extract filename from path (web-compatible)
const getBasename = (filePath: string): string => {
  // Handle both forward and backward slashes
  const normalizedPath = filePath.replaceAll('\\', '/');
  const parts = normalizedPath.split('/');
  return parts.at(-1) ?? filePath;
};

/** Populates config.anonApexFilePath (and lineOffset) from an Execute Anonymous log, matching it against
 * workspace source when possible and falling back to a synthetic .apex file written next to the log. */
const resolveAnonApexFilePath = async (config: vscode.DebugConfiguration): Promise<void> => {
  const anonSource = extractAnonApexSource(config.logFileContents);
  if (anonSource === undefined) {
    return;
  }
  const matched = await findMatchingSourceFile(anonSource);
  if (!matched) {
    const apexFilePath = config.logFilePath.replace(/\.log$/, '.apex');
    config.anonApexFilePath = await getRuntime().runPromise(writeAnonApexFile(apexFilePath, anonSource));
    return;
  }
  config.anonApexFilePath = matched.filePath;
  if (matched.lineOffset > 0) {
    config.anonApexLineOffset = matched.lineOffset;
  }
};

const writeAnonApexFile = Effect.fn('ApexReplayDebugger.writeAnonApexFile')(function* (
  filePath: string,
  contents: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const uri = yield* api.services.FsService.toUri(filePath);
  yield* api.services.FsService.safeWriteFile(uri, contents);
  return uri.fsPath;
});

type SourceMatch = { filePath: string; lineOffset: number };

const findMatchingSourceFile = async (source: string): Promise<SourceMatch | undefined> => {
  const candidates = await vscode.workspace.findFiles('**/*.{apex,cls,trigger}', '**/{.sf,.sfdx,.git,node_modules}/**');
  return getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const sourceLines = source.trimEnd().split(/\r?\n/);
      for (const candidate of candidates) {
        const result = yield* Effect.option(api.services.FsService.readFile(candidate.fsPath));
        if (result._tag !== 'Some') {
          continue;
        }
        // Exact match (whole file is the source, e.g. a .apex file)
        if (result.value.trimEnd() === source.trimEnd()) {
          return { filePath: candidate.fsPath, lineOffset: 0 };
        }
        // Subsequence match: find sourceLines as a contiguous block within fileLines
        const fileLines = result.value.split(/\r?\n/);
        if (sourceLines.length < fileLines.length) {
          for (let i = 0; i <= fileLines.length - sourceLines.length; i++) {
            if (sourceLines.every((line, j) => fileLines[i + j].trim() === line.trim())) {
              return { filePath: candidate.fsPath, lineOffset: i };
            }
          }
        }
      }
      return undefined;
    })
  );
};
