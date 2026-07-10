/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import { code2ProtocolConverter } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as ExecutionStrategy from 'effect/ExecutionStrategy';
import * as Exit from 'effect/Exit';
import * as Scope from 'effect/Scope';
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
import { fireSpan } from './services/fireSpan';
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
    // Fail (not just logError) so the span ends with ERROR status: both AppInsights exporters
    // classify by span.status.code === ERROR (severity 17/exception), else INFO (severity 9).
    getRuntime().runFork(
      Effect.annotateCurrentSpan('error', String(err?.error ?? err)).pipe(
        Effect.zipRight(Effect.fail(err)),
        Effect.withSpan(LSP_ERR, { root: true })
      )
    );
    throw err;
  }
};

const protocol2CodeConverter = (value: string) => URI.parse(value);

// Per-client-lifetime child scope of the extension scope. `createLanguageServer` runs on first
// activation AND every LSP restart, so we close the prior child scope before forking the next —
// that ends/flushes the prior `apex.lsp.client` span at restart, keeping exactly ONE live client
// span at a time (ADR-0002 invariant) instead of N unended spans accumulating until deactivate.
let clientScope: Scope.CloseableScope | undefined;

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

  // One long-lived ROOT span for the whole language-client session. `apexLSPLog` is high-volume
  // (one per Jorje feature event); per ADR-0002 we write attrs onto this single span rather than
  // emitting N top-level spans. `root: true` makes it export as top-level. The span lives in a
  // per-client child scope: closing the prior child (below) ends/flushes the prior span on restart,
  // and closeExtensionScope() on deactivate closes the parent (transitively this child) at teardown.
  const clientSpan = getRuntime().runSync(
    Effect.gen(function* () {
      const extScope = yield* getExtensionScope();
      if (clientScope) yield* Scope.close(clientScope, Exit.void); // end/flush prior client span on restart
      clientScope = yield* Scope.fork(extScope, ExecutionStrategy.sequential);
      return yield* Effect.makeSpanScoped('apex.lsp.client', { root: true }).pipe(Scope.extend(clientScope));
    })
  );

  client.onTelemetry((data: { properties?: Record<string, string>; measures?: Record<string, number> }) => {
    if (isApexLspTelemetryAllowed(data.properties)) {
      // Write directly to the held span (attrs last-write-wins); no fork, no annotateRootSpan.
      Object.entries({ ...data.properties, ...data.measures }).forEach(([k, v]) => clientSpan.attribute(k, v));
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

const getNamespaceFromProject = Effect.fn('apex.provideCodeLenses.getNamespaceFromProject')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const project = yield* api.services.ProjectService.getSfProject();
  return project.getSfProjectJson().getContents().namespace;
});

const getNamespaceFromOrg = Effect.fn('apex.provideCodeLenses.getNamespaceFromOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const connection = yield* api.services.ConnectionService.getConnection();
  // convert null to undefined
  return connection.getAuthInfoFields().namespacePrefix ?? undefined;
});

const provideCodeLenses = async (
  document: vscode.TextDocument,
  token: vscode.CancellationToken,
  next: ProvideCodeLensesSignature
) => {
  const [[nsFromOrg, nsFromProject], lenses] = await Promise.all([
    getRuntime().runPromise(
      Effect.all([getNamespaceFromOrg(), getNamespaceFromProject()], { concurrency: 'unbounded' })
    ),
    next(document, token)
  ]);
  return lenses?.map(rewriteNamespaceLens(nsFromOrg)(nsFromProject));
};
