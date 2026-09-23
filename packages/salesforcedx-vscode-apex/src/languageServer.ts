/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { code2ProtocolConverter, ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as ExecutionStrategy from 'effect/ExecutionStrategy';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import type * as Tracer from 'effect/Tracer';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  Executable,
  LanguageClientOptions,
  ProvideCodeLensesSignature,
  RevealOutputChannelOn
} from 'vscode-languageclient/node';
import { URI } from 'vscode-uri';
import { ApexErrorHandler } from './apexErrorHandler';
import { ApexLanguageClient } from './apexLanguageClient';
import { APEX_SETTINGS_SECTION, UBER_JAR_NAME } from './constants';
import { dropLsAnonymousApexExecuteLenses } from './dropLsAnonymousApexExecuteLenses';
import { soqlMiddleware } from './embeddedSoql';
import { languageClientSetupError } from './languageClientSetupErrors';
import { buildMetadataRegistryScanConfig } from './languageServerScanConfig';
import { nls } from './messages';
import { rewriteNamespaceLens } from './namespaceLensRewriter';
import { resolveRequirements } from './requirements';
import { fireSpan } from './services/fireSpan';
import { getRuntime } from './services/runtime';
import { apexLanguageServerSettings } from './settings';
import { isApexLspTelemetryAllowed } from './telemetry/apexLspTelemetryAllowlist';

const JDWP_DEBUG_PORT = 0;
const APEX_LANGUAGE_SERVER_MAIN = 'apex.jorje.lsp.ApexLanguageServerLauncher';
const SUSPEND_LANGUAGE_SERVER_STARTUP = process.env.SUSPEND_LANGUAGE_SERVER_STARTUP === 'true';
const LANGUAGE_SERVER_LOG_LEVEL = process.env.LANGUAGE_SERVER_LOG_LEVEL ?? 'ERROR';

// LSP providers controlled by the lspParityCapabilities setting
const LSP_PARITY_PROVIDERS = ['provideDocumentSymbols'];

// eslint-disable-next-line no-var
declare var v8debug: any;

type ApexLanguageClientOptions = LanguageClientOptions & { errorHandler?: ApexErrorHandler };

const startedInDebugMode = (): boolean => {
  const args = process.execArgv;
  if (args) {
    return args.some(
      arg =>
        /^--debug=?/.test(arg) || /^--debug-brk=?/.test(arg) || /^--inspect=?/.test(arg) || /^--inspect-brk=?/.test(arg)
    );
  }
  return false;
};

const DEBUG = typeof v8debug === 'object' || startedInDebugMode();

const createServer = Effect.fn('apex.lsp.createServer')(
  function* (extensionContext: vscode.ExtensionContext) {
    const requirementsData = yield* resolveRequirements().pipe(
      Effect.mapError(cause => languageClientSetupError('requirements', cause))
    );

    const { enableSemanticErrors, enableCompletionStatistics } =
      yield* (yield* ExtensionProviderService).getServicesApi.pipe(
        Effect.flatMap(api =>
          Effect.flatMap(api.services.SettingsService, settings =>
            Effect.all({
              enableSemanticErrors: settings.getValueOrElse(APEX_SETTINGS_SECTION, 'enable-semantic-errors', false),
              enableCompletionStatistics: settings.getValueOrElse(
                APEX_SETTINGS_SECTION,
                'advanced.enable-completion-statistics',
                false
              )
            })
          )
        ),
        Effect.mapError(cause => languageClientSetupError('configuration', cause))
      );

    const { languageServerDir } = yield* Schema.decodeUnknown(Schema.Struct({ languageServerDir: Schema.String }))(
      extensionContext.extension.packageJSON
    ).pipe(Effect.mapError(cause => languageClientSetupError('configuration', cause)));

    return yield* Effect.try({
      try: (): Executable => {
        const uberJar = path.resolve(extensionContext.extensionPath, languageServerDir, UBER_JAR_NAME);
        const jvmMaxHeap = requirementsData.java_memory;

        const args: string[] = [
          '-cp',
          uberJar,
          '-Ddebug.internal.errors=true',
          `-Ddebug.semantic.errors=${enableSemanticErrors}`,
          `-Ddebug.completion.statistics=${enableCompletionStatistics}`,
          '-Dlwc.typegeneration.disabled=true'
        ];

        if (jvmMaxHeap && typeof jvmMaxHeap === 'number') {
          args.push(`-Xmx${jvmMaxHeap}M`);
        }
        fireSpan('apex.lsp.settings', { maxHeapSize: jvmMaxHeap ?? 0 });

        if (DEBUG) {
          args.push(
            '-Dtrace.protocol=false',
            `-Dapex.lsp.root.log.level=${LANGUAGE_SERVER_LOG_LEVEL}`,
            `-agentlib:jdwp=transport=dt_socket,server=y,suspend=${SUSPEND_LANGUAGE_SERVER_STARTUP ? 'y' : 'n'},address=*:${JDWP_DEBUG_PORT},quiet=y`
          );
        }

        args.push(APEX_LANGUAGE_SERVER_MAIN);

        return {
          options: { env: process.env },
          command: path.resolve(`${requirementsData.java_home}/bin/java`),
          args
        };
      },
      catch: cause => languageClientSetupError('configuration', cause)
    });
  },
  Effect.tapError(error => Effect.sync(() => void vscode.window.showErrorMessage(error.message)))
);

const protocol2CodeConverter = (value: string) => URI.parse(value);

// One long-lived ROOT span per client lifetime. `apexLSPLog` is high-volume; per ADR-0002 we write
// attrs onto this single span, not N top-level spans. Held in a Ref<Option> (Effect primitive for
// shared mutable state) with its child scope so a restart can flush the prior span before the next.
const clientSpanRef = Option.none<{ scope: Scope.CloseableScope; span: Tracer.Span }>().pipe(Ref.make, Effect.runSync);

// Runs on first activation AND every restart: close the prior child scope (flushes prior span) before
// forking the next — exactly ONE live client span (ADR-0002). Forked from the extension scope so
// closeExtensionScope() on deactivate transitively closes it.
const rotateClientSpan = Effect.fn('apex.lsp.client.rotate')(function* () {
  const prev = yield* Ref.get(clientSpanRef);
  yield* Option.match(prev, {
    onNone: () => Effect.void,
    onSome: ({ scope }) => Scope.close(scope, Exit.void)
  });
  const child = yield* Scope.fork(yield* getExtensionScope(), ExecutionStrategy.sequential);
  const span = yield* Effect.makeSpanScoped('apex.lsp.client', { root: true }).pipe(Scope.extend(child));
  yield* Ref.set(clientSpanRef, Option.some({ scope: child, span }));
});

// Write allowlisted Jorje telemetry attrs onto the held client span (attrs last-write-wins); no new
// span per event (the call site forks a short fiber per event, but they all share this one span).
// onNone (no live client span) is a no-op.
const annotateClientSpan = Effect.fn('apex.lsp.client.annotate')(function* (attributes: Record<string, unknown>) {
  const current = yield* Ref.get(clientSpanRef);
  yield* Option.match(current, {
    onNone: () => Effect.void,
    onSome: ({ span }) => Effect.sync(() => Object.entries(attributes).forEach(([k, v]) => span.attribute(k, v)))
  });
});

export const createLanguageServer = Effect.fn('apex.lsp.createLanguageServer')(function* (
  extensionContext: vscode.ExtensionContext,
  outputChannel?: vscode.OutputChannel
) {
  const server = yield* createServer(extensionContext);
  const clientOptions = yield* buildClientOptions(outputChannel);
  const client = yield* Effect.try({
    try: () => new ApexLanguageClient('apex', nls.localize('client_name'), server, clientOptions),
    catch: cause => languageClientSetupError('creation', cause)
  });

  yield* rotateClientSpan();
  const runtime = yield* Effect.runtime();
  yield* Effect.try({
    try: () => {
      client.onTelemetry((data: { properties?: Record<string, string>; measures?: Record<string, number> }) => {
        if (isApexLspTelemetryAllowed(data.properties)) {
          Runtime.runFork(runtime)(annotateClientSpan({ ...data.properties, ...data.measures }));
        }
      });
    },
    catch: cause => languageClientSetupError('initialization', cause)
  });

  return client;
});

const buildClientOptions = Effect.fn('apex.lsp.buildClientOptions')(function* (outputChannel?: vscode.OutputChannel) {
  const scanConfig = yield* Effect.tryPromise({
    try: buildMetadataRegistryScanConfig,
    catch: cause => languageClientSetupError('options', cause)
  });

  const { lspParityCapabilities, ...initializationSettings } = yield* apexLanguageServerSettings().pipe(
    Effect.mapError(cause => languageClientSetupError('options', cause))
  );

  return yield* Effect.try({
    try: (): ApexLanguageClientOptions => {
      const soqlExtensionInstalled = isNotUndefined(
        vscode.extensions.getExtension('salesforce.salesforcedx-vscode-soql')
      );
      const initializationOptions = {
        enableEmbeddedSoqlCompletion: soqlExtensionInstalled,
        ...initializationSettings
      };

      // Create middleware that disables parity providers when setting is true
      const parityMiddleware: Record<string, () => null> = lspParityCapabilities
        ? Object.fromEntries(LSP_PARITY_PROVIDERS.map(provider => [provider, () => null]))
        : {};

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
        initializationOptions: scanConfig ? { ...initializationOptions, ...scanConfig } : initializationOptions,
        middleware: {
          ...parityMiddleware,
          ...(soqlExtensionInstalled ? soqlMiddleware : {}),
          provideCodeLenses
        },
        errorHandler: new ApexErrorHandler(),
        ...(isNotUndefined(outputChannel) ? { outputChannel } : {})
      };
    },
    catch: cause => languageClientSetupError('options', cause)
  });
});

const getNamespaces = Effect.fn('apex.provideCodeLenses.getNamespaces')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [conn, project] = yield* Effect.all(
    [api.services.ConnectionService.getConnection(), api.services.ProjectService.getSfProject()],
    { concurrency: 'unbounded' }
  );
  return {
    // convert null to undefined
    nsFromOrg: conn.getAuthInfoFields().namespacePrefix ?? undefined,
    nsFromProject: project.getSfProjectJson().getContents().namespace
  };
});

const provideCodeLenses = async (
  document: vscode.TextDocument,
  token: vscode.CancellationToken,
  next: ProvideCodeLensesSignature
) => {
  const [{ nsFromOrg, nsFromProject }, lenses] = await Promise.all([
    getRuntime().runPromise(getNamespaces()),
    next(document, token)
  ]);
  const rewritten = lenses?.map(rewriteNamespaceLens(nsFromOrg)(nsFromProject));
  return rewritten === undefined ? undefined : dropLsAnonymousApexExecuteLenses(rewritten);
};
