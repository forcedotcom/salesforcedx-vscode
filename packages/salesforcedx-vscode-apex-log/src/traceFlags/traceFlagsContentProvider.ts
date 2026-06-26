/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { DebugLevelItem, TraceFlagItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { buildTraceFlagsSchemas } from '../schemas/traceFlagsSchema';
import { getRuntime } from '../services/runtime';
import { isTraceFlagActive } from './traceFlagActive';

export const SCHEME = 'sf-traceflags';

type TraceFlagsByLogType = {
  DEVELOPER_LOG?: TraceFlagItem[];
  USER_DEBUG?: TraceFlagItem[];
  CLASS_TRACING?: TraceFlagItem[];
  TRIGGERS?: TraceFlagItem[];
};

const groupByLogType = (items: TraceFlagItem[]): TraceFlagsByLogType => {
  const active = items.filter(isTraceFlagActive);
  const g = Object.groupBy(active, item => (item.tracedEntityId?.startsWith('01q') ? 'TRIGGERS' : item.logType));
  // Object.groupBy returns Partial; we ensure all keys exist
  // const g: Partial<Record<keyof TraceFlagsByLogType, TraceFlagItem[]>> = grouped;
  return {
    DEVELOPER_LOG: g.DEVELOPER_LOG ?? [],
    USER_DEBUG: g.USER_DEBUG ?? [],
    CLASS_TRACING: g.CLASS_TRACING ?? [],
    TRIGGERS: g.TRIGGERS ?? []
  };
};

/**
 * A trace flag is orphaned when it references a DebugLevel (debugLevelId is set) that could not be
 * resolved to a name — neither from the TraceFlag→DebugLevel join nor the separate DebugLevel query.
 * Operate on an already-enriched item (one whose debugLevelName has been populated by enrichTraceFlags).
 */
export const isOrphanedTraceFlag = (tf: TraceFlagItem): boolean =>
  tf.debugLevelId !== undefined && tf.debugLevelName === undefined;

/**
 * Resolves each trace flag's debug level name, preferring the name carried on the trace flag
 * (from the TraceFlag→DebugLevel relationship join) and falling back to the separate DebugLevel
 * query. A trace flag whose debugLevelId resolves to no name is returned as an orphan but still
 * included in `enriched` — an unresolvable debug level must never block the whole view (#7528).
 */
export const enrichTraceFlags = (
  traceFlags: TraceFlagItem[],
  debugLevels: DebugLevelItem[]
): { enriched: TraceFlagItem[]; orphans: TraceFlagItem[] } => {
  const debugLevelMap = new Map(debugLevels.map(dl => [dl.id, dl.developerName]));
  const enriched = traceFlags.map(tf => ({
    ...tf,
    debugLevelName: tf.debugLevelName ?? (tf.debugLevelId ? debugLevelMap.get(tf.debugLevelId) : undefined)
  }));
  return { enriched, orphans: enriched.filter(isOrphanedTraceFlag) };
};

const fetchTraceFlagsContent = Effect.fn('ApexLog.fetchTraceFlagsContent')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { encodeTraceFlagsConfigToJson } = buildTraceFlagsSchemas(api.services.TraceFlagItemStruct);
  const traceFlagService = yield* api.services.TraceFlagService;
  const channelService = yield* api.services.ChannelService;

  const [traceFlags, debugLevels] = yield* Effect.all(
    [
      traceFlagService
        .getTraceFlags()
        .pipe(
          Effect.catchAll(e =>
            channelService
              .appendToChannel(`Trace flags fetch failed: ${String(e)}`)
              .pipe(Effect.andThen(Effect.succeed<TraceFlagItem[]>([])))
          )
        ),
      traceFlagService
        .getDebugLevels()
        .pipe(
          Effect.catchAll(e =>
            channelService
              .appendToChannel(`Debug levels fetch failed: ${String(e)}`)
              .pipe(Effect.andThen(Effect.succeed<DebugLevelItem[]>([])))
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

    return getRuntime().runPromise(
      fetchTraceFlagsContent().pipe(
        Effect.catchAll((e: unknown) =>
          Effect.succeed(JSON.stringify({ error: `Failed to fetch trace flags: ${String(e)}` }, undefined, 2))
        )
      )
    );
  }

  public refresh(orgId: string): void {
    this._onDidChange.fire(createTraceFlagsUri(orgId));
  }
}

// Must survive across Layer builds (each command run rebuilds the layer).
// eslint-disable-next-line functional/no-let -- Singleton provider; commands get a fresh service but must refresh the same instance
let providerInstance: TraceFlagsContentProviderClass | undefined;

/** Effect.Service providing the trace flags virtual document provider (singleton). */
export class TraceFlagsContentProviderService extends Effect.Service<TraceFlagsContentProviderService>()(
  'TraceFlagsContentProviderService',
  {
    accessors: true,
    dependencies: [],
    effect: Effect.sync(() => {
      providerInstance ??= new TraceFlagsContentProviderClass();
      const provider = providerInstance;
      return {
        provider,
        refresh: (orgId: string) => provider.refresh(orgId)
      };
    })
  }
) {}

/** URI format: sf-traceflags:org/{orgId}/traceFlags.json */
export const createTraceFlagsUri = (orgId: string): URI => URI.parse(`${SCHEME}:org/${orgId}/traceFlags.json`);

const extractOrgIdFromUri = (uri: URI): string | undefined => {
  const match = uri.path.match(/^org\/([^/]+)\/traceFlags\.json$/);
  return match?.[1];
};
