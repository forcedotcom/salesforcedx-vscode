/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';

type ViewChangesOptions = { local: boolean; remote: boolean };

const getTitle = (changes: StatusOutputRow[], sectionTitle: string): string[] => [
  '',
  `${sectionTitle} (${changes.length}):`
];

const rowToLine = (row: StatusOutputRow): string =>
  `  ${String(row.type)}: ${String(row.fullName)}${row.filePath ? ` (${String(row.filePath)})` : ''}`;

/** Format section: returns empty string when undefined (not requested), otherwise always shows header */
const formatChanges = (changes: StatusOutputRow[] | undefined, sectionTitle: string): string =>
  changes !== undefined ? [...getTitle(changes, sectionTitle), ...changes.map(rowToLine)].join('\n') : '';

const viewChangesEffect = Effect.fn('viewChanges')(function* (options: ViewChangesOptions) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const channel = yield* channelService.getChannel;
  const tracking = yield* Effect.flatMap(api.services.SourceTrackingService, svc => svc.getSourceTracking());

  if (!tracking) {
    yield* channelService.appendToChannel('No source tracking available for this org');
    return;
  }

  // Re-read both remote and local tracking to ensure fresh data
  yield* Effect.all(
    [
      ...(options.remote ? [Effect.promise(() => tracking.reReadRemoteTracking())] : []),
      ...(options.local ? [Effect.promise(() => tracking.reReadLocalTrackingCache())] : [])
    ],
    { concurrency: 'unbounded' }
  );
  const status = (yield* Effect.tryPromise(() => tracking.getStatus(options))).filter(row => !row.ignored);

  const remoteChanges = options.remote ? status.filter(row => row.origin === 'remote' && !row.conflict) : undefined;
  const localChanges = options.local ? status.filter(row => row.origin === 'local' && !row.conflict) : undefined;
  const conflicts = status.filter(row => row.conflict);

  const title =
    options.local && options.remote ? 'Source Tracking Details' : options.local ? 'Local Changes' : 'Remote Changes';

  const output = [
    '',
    `${title}:`,
    formatChanges(remoteChanges, 'Remote Changes'),
    formatChanges(localChanges, 'Local Changes'),
    formatChanges(conflicts, 'Conflicts')
  ].join('\n');

  yield* channelService.appendToChannel(output);
  yield* Effect.sync(() => channel.show());
});

/** Show detailed source tracking changes in the output channel */
export const viewAllChanges = async (): Promise<void> =>
  Effect.runPromise(viewChangesEffect({ local: true, remote: true }).pipe(Effect.provide(AllServicesLayer)));

/** Show local changes only in the output channel */
export const viewLocalChanges = async (): Promise<void> =>
  Effect.runPromise(viewChangesEffect({ local: true, remote: false }).pipe(Effect.provide(AllServicesLayer)));

/** Show remote changes only in the output channel */
export const viewRemoteChanges = async (): Promise<void> =>
  Effect.runPromise(viewChangesEffect({ local: false, remote: true }).pipe(Effect.provide(AllServicesLayer)));
