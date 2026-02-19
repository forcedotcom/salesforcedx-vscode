/*
 * Copyright (c) 2025, salesforce.com, inc.
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
import { AllServicesLayer } from '../services/allServicesLayerRef';

export const SCHEME = 'sf-traceflags';

type TraceFlagsByLogType = {
  DEVELOPER_LOG?: TraceFlagItem[];
  USER_DEBUG?: TraceFlagItem[];
  CLASS_TRACING?: TraceFlagItem[];
  TRIGGERS?: TraceFlagItem[];
};

const groupByLogType = (items: TraceFlagItem[]): TraceFlagsByLogType => {
  const active = items.filter(item => item.isActive);
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

const fetchTraceFlagsContent = () =>
  Effect.gen(function* () {
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

    return encodeTraceFlagsConfigToJson({
      traceFlags: groupByLogType(traceFlags),
      debugLevels
    });
  }).pipe(Effect.provide(AllServicesLayer));

/**
 * Virtual document provider for trace flags. Fetches from org on demand; no file on disk.
 * Documents are read-only.
 */
class TraceFlagsContentProviderClass implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  public readonly onDidChange = this._onDidChange.event;

  public async provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): Promise<string> {
    void this.onDidChange; // satisfy class-methods-use-this (interface impl)
    const orgId = extractOrgIdFromUri(uri);
    if (!orgId) return JSON.stringify({ error: 'Invalid trace flags URI: orgId missing' });

    return Effect.runPromise(
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

export type TraceFlagsContentProvider = TraceFlagsContentProviderClass;

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
export const createTraceFlagsUri = (orgId: string): vscode.Uri => URI.parse(`${SCHEME}:org/${orgId}/traceFlags.json`);

const extractOrgIdFromUri = (uri: vscode.Uri): string | undefined => {
  const match = uri.path.match(/^org\/([^/]+)\/traceFlags\.json$/);
  return match?.[1];
};
