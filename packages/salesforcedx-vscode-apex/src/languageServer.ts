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
import * as Ref from 'effect/Ref';
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
import { LSP_ERR, UBER_JAR_NAME } from './constants';
import { soqlMiddleware } from './embeddedSoql';
import { buildMetadataRegistryScanConfig } from './languageServerScanConfig';
import { nls } from './messages';
import { rewriteNamespaceLens } from './namespaceLensRewriter';
import * as requirements from './requirements';
import { fireErrorSpan, fireSpan } from './services/fireSpan';
import { getRuntime } from './services/runtime';
import {
  retrieveEnableApexLSErrorToTelemetry,
  retrieveEnableSyncInitJobs,
  retrieveAAClassDefModifiers,
  retrieveAAClassAccessModifiers,
  retrieveAAMethodDefModifiers,
  retrieveAAMethodAccessModifiers,
  retrieveAAPropDefModifiers,
  retrieveAAPropAccessModifiers,
  retrieveAAClassRestAnnotations,
  retrieveAAMethodRestAnnotations,
  retrieveAAMethodAnnotations,
  retrieveGeneralClassAccessModifiers,
  retrieveGeneralMethodAccessModifiers,
  retrieveGeneralPropAccessModifiers
} from './settings';
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
      (arg: any) =>
        /^--debug=?/.test(arg) || /^--debug-brk=?/.test(arg) || /^--inspect=?/.test(arg) || /^--inspect-brk=?/.test(arg)
    );
  }
  return false;
};

const DEBUG = typeof v8debug === 'object' || startedInDebugMode();

const createServer = async (extensionContext: vscode.ExtensionContext): Promise<Executable> => {
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
    fireErrorSpan(LSP_ERR, err);
    throw err;
  }
};

const protocol2CodeConverter = (value: string) => URI.parse(value);

// One long-lived ROOT span per client lifetime. `apexLSPLog` is high-volume; per ADR-0002 we write
// attrs onto this single span, not N top-level spans. Held in a Ref<Option> (Effect primitive for
// shared mutable state) with its child scope so a restart can flush the prior span before the next.
const clientSpanRef = Effect.runSync(Ref.make(Option.none<{ scope: Scope.CloseableScope; span: Tracer.Span }>()));

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

export const createLanguageServer = async (
  extensionContext: vscode.ExtensionContext,
  outputChannel?: vscode.OutputChannel
): Promise<ApexLanguageClient> => {
  const server = await createServer(extensionContext);
  const client = new ApexLanguageClient(
    'apex',
    nls.localize('client_name'),
    server,
    await buildClientOptions(outputChannel)
  );

  await getRuntime().runPromise(rotateClientSpan());

  client.onTelemetry((data: { properties?: Record<string, string>; measures?: Record<string, number> }) => {
    if (isApexLspTelemetryAllowed(data.properties)) {
      getRuntime().runFork(annotateClientSpan({ ...data.properties, ...data.measures }));
    }
  });

  return client;
};

const buildClientOptions = async (outputChannel?: vscode.OutputChannel): Promise<ApexLanguageClientOptions> => {
  const soqlExtensionInstalled = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-soql') !== undefined;
  const lspParityCapabilities = vscode.workspace
    .getConfiguration()
    .get<boolean>('salesforcedx-vscode-apex.advanced.lspParityCapabilities', true);
  const scanConfig = await buildMetadataRegistryScanConfig();
  const initializationOptions = {
    enableEmbeddedSoqlCompletion: soqlExtensionInstalled,
    enableErrorToTelemetry: retrieveEnableApexLSErrorToTelemetry(),
    enableSynchronizedInitJobs: retrieveEnableSyncInitJobs(),
    apexActionClassDefModifiers: retrieveAAClassDefModifiers().join(','),
    apexActionClassAccessModifiers: retrieveAAClassAccessModifiers().join(','),
    apexActionMethodDefModifiers: retrieveAAMethodDefModifiers().join(','),
    apexActionMethodAccessModifiers: retrieveAAMethodAccessModifiers().join(','),
    apexActionPropDefModifiers: retrieveAAPropDefModifiers().join(','),
    apexActionPropAccessModifiers: retrieveAAPropAccessModifiers().join(','),
    apexActionClassRestAnnotations: retrieveAAClassRestAnnotations().join(','),
    apexActionMethodRestAnnotations: retrieveAAMethodRestAnnotations().join(','),
    apexActionMethodAnnotations: retrieveAAMethodAnnotations().join(','),
    apexOASClassAccessModifiers: retrieveGeneralClassAccessModifiers().join(','),
    apexOASMethodAccessModifiers: retrieveGeneralMethodAccessModifiers().join(','),
    apexOASPropAccessModifiers: retrieveGeneralPropAccessModifiers().join(',')
  };

  // Create middleware that disables parity providers when setting is true
  const parityMiddleware: Record<string, () => null> = lspParityCapabilities
    ? Object.fromEntries(LSP_PARITY_PROVIDERS.map(provider => [provider, () => null]))
    : {};

  const options: ApexLanguageClientOptions = {
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
    errorHandler: new ApexErrorHandler()
  };

  // Reuse existing output channel if provided to avoid creating duplicates on restart
  if (outputChannel) {
    options.outputChannel = outputChannel;
  }

  return options;
};

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
  return lenses?.map(rewriteNamespaceLens(nsFromOrg)(nsFromProject));
};
