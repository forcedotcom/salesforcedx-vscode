/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { DeployOutcome, FileResponseInfo } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { Utils, URI } from 'vscode-uri';
import { nls } from '../../messages';
import { MissingDefaultOrgError } from '../diff/diffErrors';
import { clearDeployDiagnostics } from './deployDiagnostics';
import { DeployCompletedWithErrorsError } from './deployErrors';

const makeKey = (type: string, name: string): string => `${type}#${name}`;

/** Merge file-level failures with componentFailures (owned outcome version, sync). */
const getMergedDeployFailuresFromOutcome = (outcome: DeployOutcome): readonly FileResponseInfo[] => {
  const failures = outcome.fileResponses.filter(fr => fr.state === 'Failed');
  if (outcome.componentFailures.length <= failures.length) return failures;

  const seen = new Set(failures.map(f => makeKey(f.type, f.fullName)));
  const extras = outcome.componentFailures
    .filter(m => !seen.has(makeKey(m.type, m.fullName)))
    .map(
      (m): FileResponseInfo => ({
        fullName: m.fullName,
        type: m.type,
        state: 'Failed',
        error: m.problem,
        problemType: m.problemType
      })
    );
  return [...failures, ...extras];
};

/** Matches {@link ComponentSetService.getComponentState}; avoids importing from services in this package. */
type ComponentChangeKind = 'created' | 'changed' | 'unchanged' | 'deleted';

/** Map SDR file state to our change classification. Lowercase the state; default 'changed'. */
const stateToChange = (state: string): ComponentChangeKind => {
  const lower = state.toLowerCase();
  if (lower === 'created' || lower === 'changed' || lower === 'unchanged' || lower === 'deleted') {
    return lower;
  }
  return 'changed';
};

/** When the deploy did not apply, avoid API labels like "Created" that imply the org was updated. */
const notDeployedOutcomeLabel = (change: ComponentChangeKind): string => {
  switch (change) {
    case 'created':
      return 'Would have been created';
    case 'changed':
      return 'Would have been updated';
    case 'unchanged':
      return 'Would have had no changes';
    case 'deleted':
      return 'Would have been deleted';
  }
};

const formatDeployedLines = (responses: readonly FileResponseInfo[]) =>
  responses.map(r => `${r.state} ${r.type} ${r.filePath ? URI.file(r.filePath).toString() : r.fullName}`).join('\n');

const formatNotDeployedLines = (responses: readonly FileResponseInfo[]) =>
  responses
    .map(r => {
      const path = r.filePath ? URI.file(r.filePath).toString() : r.fullName;
      const label = notDeployedOutcomeLabel(stateToChange(r.state));
      return `${label} — ${r.type} ${path}`;
    })
    .join('\n');

/** Format deploy outcome for channel output (data-only, owned types). */
const formatDeployOutputFromOutcome = (outcome: DeployOutcome): string => {
  const failed = getMergedDeployFailuresFromOutcome(outcome);
  const applied = outcome.appliedToOrg;

  const successResponses = outcome.fileResponses.filter(fr => fr.state !== 'Failed');
  const { deploys = [], deleted = [] } = Object.groupBy(successResponses, fr =>
    fr.state === 'Deleted' ? 'deleted' : 'deploys'
  );

  const successSection =
    deploys.length > 0
      ? applied
        ? `\n=== Deployed Source (${deploys.length}) ===\n${formatDeployedLines(deploys)}\n`
        : `\n=== Components without file-level errors (${deploys.length}) — not deployed ===\n` +
          'The deploy did not complete successfully, so no metadata changes were applied to the org. ' +
          `The following had no file-level errors but were not deployed:\n${formatNotDeployedLines(deploys)}\n`
      : '';

  const deletedSection =
    deleted.length > 0
      ? applied
        ? `\n=== Deleted Source (${deleted.length}) ===\n${formatDeployedLines(deleted)}\n`
        : `\n=== Deletes without file-level errors (${deleted.length}) — not applied ===\n` +
          'The deploy did not complete successfully, so no metadata changes were applied to the org. ' +
          `The following deletes had no file-level errors but were not applied:\n${formatNotDeployedLines(deleted)}\n`
      : '';

  const failureSection =
    failed.length > 0
      ? `\n=== Deploy Errors (${failed.length}) ===\n${failed
          .map(r => {
            const error = r.error ?? 'Unknown error';
            return `ERROR: ${r.filePath ?? r.fullName}: ${error}`;
          })
          .join('\n')}\n`
      : '';

  return successSection + deletedSection + failureSection;
};

const deployErrorCollection = vscode.languages.createDiagnosticCollection('deploy-errors');

const fixupError = (error: string | undefined): string =>
  error !== undefined ? error.replace(/\(\d+:\d+\)/, '').trim() : 'Unknown error occurred.';

const getRange = (lineNumber = 1, columnNumber = 1): vscode.Range => {
  const pos = new vscode.Position(lineNumber > 0 ? lineNumber - 1 : 0, columnNumber > 0 ? columnNumber - 1 : 0);
  return new vscode.Range(pos, pos);
};

const handleDuplicateDiagnostics = (diagnosticMap: Map<URI, vscode.Diagnostic[]>): Map<URI, vscode.Diagnostic[]> =>
  new Map(
    [...diagnosticMap.entries()].map(([uri, diagnostics]) => {
      const existingKeys = new Set(vscode.languages.getDiagnostics(uri).map(d => d.message));
      const filtered = diagnostics.filter(d => {
        if (existingKeys.has(d.message)) return false;
        existingKeys.add(d.message);
        return true;
      });
      return [uri, filtered] as const;
    })
  );

const resolveFileUri = Effect.fn('deployFromOutcome.resolveFileUri')(function* (
  workspaceUri: URI,
  filePath: string | undefined
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fs = yield* api.services.FsService;
  const workspacePath = yield* fs.uriToPath(workspaceUri);
  const isAbsolute = filePath && (filePath.startsWith('/') || filePath.includes(workspacePath));
  return isAbsolute ? yield* fs.toUri(filePath) : Utils.resolvePath(workspaceUri, filePath ?? '');
});

/** Apply deploy failures to Problems panel (outcome version). */
const applyDeployDiagnosticsFromOutcome = Effect.fn('deployFromOutcome.applyDiagnostics')(function* (
  failedResponses: readonly FileResponseInfo[]
) {
  const workspaceUri = yield* (yield* ExtensionProviderService).getServicesApi.pipe(
    Effect.flatMap(api => api.services.WorkspaceService.getWorkspaceInfoOrThrow()),
    Effect.map(w => w.uri)
  );

  deployErrorCollection.clear();

  const entries = yield* Effect.all(
    failedResponses.map(fileResponse =>
      Effect.gen(function* () {
        const fileUri = yield* resolveFileUri(workspaceUri, fileResponse.filePath);
        const { lineNumber, columnNumber, error, problemType, type } = fileResponse;
        const range = getRange(lineNumber, columnNumber);
        const severity = problemType === 'Error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
        const vscDiagnostic: vscode.Diagnostic = {
          message: fixupError(error),
          range,
          severity,
          source: type
        };
        return [fileUri, vscDiagnostic] as const;
      })
    ),
    { concurrency: 'unbounded' }
  );

  const byUri = Object.groupBy(entries, ([uri]) => uri.toString());
  const toEntry = (uri: URI, diags: vscode.Diagnostic[]): [URI, vscode.Diagnostic[]] => [uri, diags];
  const diagnosticMap = new Map<URI, vscode.Diagnostic[]>(
    Object.values(byUri).map(pairs => {
      const [uri] = pairs![0];
      return toEntry(
        uri,
        pairs!.map(([, d]) => d)
      );
    })
  );

  [...handleDuplicateDiagnostics(diagnosticMap).entries()].map(([uri, diagMap]) =>
    deployErrorCollection.set(uri, diagMap.length > 0 ? diagMap : undefined)
  );
});

const isSucceeded = (status: string | undefined) => status === 'Succeeded' || status === 'SucceededPartial';

/** Store deploy outcome if it succeeded and org doesn't track source (outcome version). */
const maybeStoreDeployOutcome = Effect.fn('deployFromOutcome.maybeStoreOutcome')(function* (outcome: DeployOutcome) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  if (!isSucceeded(outcome.status) || orgInfo.tracksSource === true) return;

  const timestamp = outcome.completedDate
    ? DateTime.unsafeMake(new Date(outcome.completedDate))
    : DateTime.unsafeMake(new Date());

  const components = outcome.fileResponses.map(fr => ({
    metadataType: fr.type,
    fullName: fr.fullName,
    lastModifiedDate: DateTime.formatIso(timestamp)
  }));

  // Store the result
  const [workspaceInfo, defaultOrgRef] = yield* Effect.all(
    [api.services.WorkspaceService.getWorkspaceInfoOrThrow(), Effect.succeed(api.services.TargetOrgRef)],
    { concurrency: 'unbounded' }
  );
  const orgId = (yield* SubscriptionRef.get(yield* defaultOrgRef())).orgId;
  if (!orgId) {
    return yield* new MissingDefaultOrgError({ message: nls.localize('missing_default_org') });
  }
  const dirUri = Utils.joinPath(workspaceInfo.uri, '.sfdx', 'fileResponses', orgId);
  yield* api.services.FsService.createDirectory(dirUri);

  const json = JSON.stringify({
    timestamp: DateTime.formatIso(timestamp),
    operation: 'deploy',
    components
  });

  yield* api.services.FsService.safeWriteFile(
    Utils.joinPath(dirUri, `deploy-${DateTime.formatIso(timestamp).replaceAll(/[:.]/g, '-')}.json`),
    json
  );
});

/** Present + persist an already-completed (data-only) deploy outcome. The deploy itself ran in services. */
export const deployFromOutcome = Effect.fn('deployFromOutcome')(function* (outcome: DeployOutcome) {
  clearDeployDiagnostics();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(formatDeployOutputFromOutcome(outcome));
  yield* maybeStoreDeployOutcome(outcome);

  const failedResponses = getMergedDeployFailuresFromOutcome(outcome);
  const failedWithPaths = failedResponses.filter(
    (fr): fr is typeof fr & { filePath: string } => typeof fr.filePath === 'string' && fr.filePath.length > 0
  );
  if (failedResponses.length > 0) {
    if (failedWithPaths.length > 0) yield* applyDeployDiagnosticsFromOutcome(failedWithPaths);
    yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
    return yield* new DeployCompletedWithErrorsError({
      userMessage: nls.localize('deploy_completed_with_errors_message')
    });
  }
});
