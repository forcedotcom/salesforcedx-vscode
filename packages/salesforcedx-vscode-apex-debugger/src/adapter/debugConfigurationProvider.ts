/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { DEBUGGER_LAUNCH_TYPE, DEBUGGER_TYPE, WorkspaceSettings } from '@salesforce/salesforcedx-apex-debugger';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isError, isString, isUndefined } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { getActiveApexExtension } from '../context/apexExtension';
import { nls } from '../messages';
import { getRuntime } from '../services/runtime';

type ActiveApexExtension = Effect.Effect.Success<ReturnType<typeof getActiveApexExtension>>;

class DebugConfigurationError extends Schema.TaggedError<DebugConfigurationError>()('DebugConfigurationError', {
  message: Schema.String
}) {}

class LanguageClientNotReady extends Schema.TaggedError<LanguageClientNotReady>()('LanguageClientNotReady', {
  message: Schema.String
}) {}

const errorMessage = (cause: unknown): string => (isError(cause) ? cause.message : String(cause));

const applyDebugConfigDefaults = Effect.fn('ApexDebugger.applyDebugConfigDefaults')(
  (folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration) =>
    Effect.sync(() => {
      config.name = config.name || nls.localize('config_name_text');
      config.type = config.type || DEBUGGER_TYPE;
      config.request = config.request || DEBUGGER_LAUNCH_TYPE;
      if (isUndefined(config.userIdFilter)) {
        config.userIdFilter = [];
      }
      if (isUndefined(config.requestTypeFilter)) {
        config.requestTypeFilter = [];
      }
      if (isUndefined(config.entryPointFilter)) {
        config.entryPointFilter = '';
      }
      const defaultProject = folder ? folder.uri.fsPath : '${workspaceRoot}';
      config.salesforceProject = isString(config.salesforceProject) ? config.salesforceProject : defaultProject;
    })
);

const readWorkspaceSettings = Effect.fn('ApexDebugger.readWorkspaceSettings')(function* () {
  const settings = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.SettingsService;
  return yield* Effect.all(
    {
      proxyUrl: settings.getValueOrElse('http', 'proxy', ''),
      proxyStrictSSL: settings.getValueOrElse('http', 'proxyStrictSSL', false),
      proxyAuth: settings.getValueOrElse('http', 'proxyAuthorization', ''),
      connectionTimeoutMs: settings.getValueOrElse('salesforcedx-vscode-apex-debugger', 'connectionTimeoutMs', 20_000)
    },
    { concurrency: 'unbounded' }
  );
});

const waitForLanguageClientReady = Effect.fn('ApexDebugger.waitForLanguageClientReady')(
  (extension: ActiveApexExtension) =>
    Effect.sync(() => extension.exports.languageClientManager.getStatus()).pipe(
      Effect.filterOrFail(
        status => status.isReady() || !status.failedToInitialize(),
        status => new DebugConfigurationError({ message: status.getStatusMessage() })
      ),
      Effect.filterOrFail(
        status => status.isReady(),
        () => new LanguageClientNotReady({ message: nls.localize('language_client_not_ready') })
      ),
      Effect.asVoid,
      Effect.retry({
        schedule: Schedule.fixed(Duration.millis(100)).pipe(Schedule.intersect(Schedule.recurs(30))),
        while: error => error._tag === 'LanguageClientNotReady'
      })
    )
);

const resolveDebugConfig = Effect.fn('ApexDebugger.resolveDebugConfig')(function* (
  folder: vscode.WorkspaceFolder | undefined,
  config: vscode.DebugConfiguration
) {
  yield* applyDebugConfigDefaults(folder, config);
  if (vscode.workspace) {
    config.workspaceSettings = {
      ...(yield* readWorkspaceSettings())
    } satisfies WorkspaceSettings;
  }
  config.lineBreakpointInfo = yield* getActiveApexExtension().pipe(
    Effect.tap(waitForLanguageClientReady),
    Effect.flatMap(extension =>
      Effect.tryPromise({
        try: () => extension.exports.getLineBreakpointInfo(),
        catch: cause => new DebugConfigurationError({ message: errorMessage(cause) })
      })
    )
  );
  return config;
});

const reportDebugConfigFailure = (error: { readonly message: string }) =>
  Effect.promise(() => vscode.window.showErrorMessage(error.message, { modal: true })).pipe(Effect.as(undefined));

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  public static getConfig(folder: vscode.WorkspaceFolder | undefined): vscode.DebugConfiguration {
    return {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      userIdFilter: [],
      requestTypeFilter: [],
      entryPointFilter: '',
      salesforceProject: folder ? folder.uri.fsPath : '${workspaceRoot}'
    };
  }

  public provideDebugConfigurations(
    folder: vscode.WorkspaceFolder | undefined,
    _token?: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
    return [DebugConfigurationProvider.getConfig(folder)];
  }

  public resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
    _token?: vscode.CancellationToken
  ): Promise<vscode.DebugConfiguration | undefined> {
    return resolveDebugConfig(folder, config).pipe(
      Effect.catchTags({
        ApexExtensionUnavailable: reportDebugConfigFailure,
        DebugConfigurationError: reportDebugConfigFailure,
        LanguageClientNotReady: reportDebugConfigFailure
      }),
      getRuntime().runPromise
    );
  }
}
