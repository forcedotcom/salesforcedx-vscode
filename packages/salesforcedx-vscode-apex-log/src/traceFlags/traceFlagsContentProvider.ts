/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { DebugLevelItem, TraceFlagItem } from '@salesforce/vscode-services/v2';
import * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isNotUndefined, isUndefined } from 'effect/Predicate';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { buildTraceFlagsSchemas } from '../schemas/traceFlagsSchema';
import { getRuntime } from '../services/runtime';
import { isTraceFlagActive } from './traceFlagActive';

export const SCHEME = 'sf-traceflags';

type TraceFlagsByLogType = {
  DEVELOPER_LOG: readonly TraceFlagItem[];
  USER_DEBUG: readonly TraceFlagItem[];
  CLASS_TRACING: readonly TraceFlagItem[];
  TRIGGERS: readonly TraceFlagItem[];
};

const groupByLogType = (items: readonly TraceFlagItem[]): TraceFlagsByLogType => {
  const active = items.filter(isTraceFlagActive);
  const grouped = Arr.groupBy(active, item => (item.tracedEntityId?.startsWith('01q') ? 'TRIGGERS' : item.logType));
  return {
    DEVELOPER_LOG: grouped.DEVELOPER_LOG ?? [],
    USER_DEBUG: grouped.USER_DEBUG ?? [],
    CLASS_TRACING: grouped.CLASS_TRACING ?? [],
    TRIGGERS: grouped.TRIGGERS ?? []
  };
};

/**
 * A trace flag is orphaned when it references a DebugLevel (debugLevelId is set) that could not be
 * resolved to a name — neither from the TraceFlag→DebugLevel join nor the separate DebugLevel query.
 * Operate on an already-enriched item (one whose debugLevelName has been populated by enrichTraceFlags).
 */
export const isOrphanedTraceFlag = (tf: TraceFlagItem): boolean =>
  isNotUndefined(tf.debugLevelId) && isUndefined(tf.debugLevelName);

/**
 * Resolves each trace flag's debug level name, preferring the name carried on the trace flag
 * (from the TraceFlag→DebugLevel relationship join) and falling back to the separate DebugLevel
 * query. A trace flag whose debugLevelId resolves to no name is returned as an orphan but still
 * included in `enriched` — an unresolvable debug level must never block the whole view (#7528).
 */
export const enrichTraceFlags = (
  traceFlags: readonly TraceFlagItem[],
  debugLevels: readonly DebugLevelItem[]
): { enriched: readonly TraceFlagItem[]; orphans: readonly TraceFlagItem[] } => {
  const debugLevelMap = new Map(debugLevels.map(dl => [dl.id, dl.developerName]));
  const enriched = traceFlags.map(tf => ({
    ...tf,
    debugLevelName: tf.debugLevelName ?? (tf.debugLevelId ? debugLevelMap.get(tf.debugLevelId) : undefined)
  }));
  return { enriched, orphans: enriched.filter(isOrphanedTraceFlag) };
};

const fetchTraceFlagsContent = Effect.fn('ApexLog.fetchTraceFlagsContent')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { encodeTraceFlagsConfigToJson } = buildTraceFlagsSchemas();
  const traceFlagService = yield* api.v2.services.TraceFlagService;
  const channelService = yield* api.v2.services.ChannelService;

  const [traceFlags, debugLevels] = yield* Effect.all(
    [
      traceFlagService
        .getTraceFlags()
        .pipe(
          Effect.catch(e =>
            channelService
              .appendToChannel(`Trace flags fetch failed: ${String(e)}`)
              .pipe(Effect.andThen(Effect.succeed<readonly TraceFlagItem[]>([])))
          )
        ),
      traceFlagService
        .getDebugLevels()
        .pipe(
          Effect.catch(e =>
            channelService
              .appendToChannel(`Debug levels fetch failed: ${String(e)}`)
              .pipe(Effect.andThen(Effect.succeed<readonly DebugLevelItem[]>([])))
          )
        )
    ],
    { concurrency: 'unbounded' }
  );

  const { enriched, orphans } = enrichTraceFlags(traceFlags, debugLevels);
  yield* Effect.forEach(orphans, tf =>
    channelService.appendToChannel(
      `Trace flag ${tf.id} references DebugLevel ${tf.debugLevelId} not returned by the DebugLevel query; showing without a name.`
    )
  );

  return encodeTraceFlagsConfigToJson({
    traceFlags: groupByLogType(enriched),
    debugLevels
  });
});

/**
 * Virtual document provider for trace flags. Fetches from org on demand; no file on disk.
 * Documents are read-only.
 */
class TraceFlagsContentProviderClass implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<URI>();

  public readonly onDidChange = this._onDidChange.event;

  public async provideTextDocumentContent(uri: URI, _token: vscode.CancellationToken): Promise<string> {
    void this.onDidChange; // satisfy class-methods-use-this (interface impl)
    const orgId = extractOrgIdFromUri(uri);
    if (!orgId) return JSON.stringify({ error: 'Invalid trace flags URI: orgId missing' });

    return fetchTraceFlagsContent().pipe(
      Effect.catch((e: unknown) =>
        Effect.succeed(JSON.stringify({ error: `Failed to fetch trace flags: ${String(e)}` }, undefined, 2))
      ),
      getRuntime().runPromise
    );
  }

  public refresh(orgId: string): void {
    this._onDidChange.fire(createTraceFlagsUri(orgId));
  }
}

// Singleton provider; runtime is captured at registration time so the same instance must survive across command invocations.
// eslint-disable-next-line functional/no-let -- Singleton provider; commands get a fresh service but must refresh the same instance
let providerInstance: TraceFlagsContentProviderClass | undefined;

/** V4 service providing the trace flags virtual document provider (singleton). */
export class TraceFlagsContentProviderService extends Context.Service<
  TraceFlagsContentProviderService,
  {
    readonly provider: TraceFlagsContentProviderClass;
    readonly refresh: (orgId: string) => void;
  }
>()('TraceFlagsContentProviderService') {
  public static readonly layer = Layer.sync(TraceFlagsContentProviderService, () => {
    providerInstance ??= new TraceFlagsContentProviderClass();
    const provider = providerInstance;
    return TraceFlagsContentProviderService.of({
      provider,
      refresh: (orgId: string) => provider.refresh(orgId)
    });
  });
}

/** URI format: sf-traceflags:org/{orgId}/traceFlags.json */
export const createTraceFlagsUri = (orgId: string): URI => URI.parse(`${SCHEME}:org/${orgId}/traceFlags.json`);

const extractOrgIdFromUri = (uri: URI): string | undefined => {
  const match = uri.path.match(/^org\/([^/]+)\/traceFlags\.json$/);
  return match?.[1];
};
