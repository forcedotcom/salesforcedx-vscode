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

const formatChanges = (changes: StatusOutputRow[], sectionTitle: string): string =>
  [
    getTitle(changes, sectionTitle),
    ...changes.map(
      row => `  ${String(row.type)}: ${String(row.fullName)}${row.filePath ? ` (${String(row.filePath)})` : ''}`
    )
  ].join('\n');

const viewChangesEffect = Effect.fn('viewChanges')(function* (options: ViewChangesOptions) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const channel = yield* channelService.getChannel;
  const tracking = yield* Effect.flatMap(api.services.SourceTrackingService, svc => svc.getSourceTracking());

  if (!tracking) {
    yield* channelService.appendToChannel('No source tracking available for this org');
    return;
  }

  yield* Effect.promise(() => tracking.reReadLocalTrackingCache());
  const status = yield* Effect.tryPromise(() => tracking.getStatus(options));

  const remoteChanges = options.remote
    ? status.filter(row => row.origin === 'remote' && !row.conflict && !row.ignored)
    : [];
  const localChanges = options.local
    ? status.filter(row => row.origin === 'local' && !row.conflict && !row.ignored)
    : [];
  const conflicts = status.filter(row => row.conflict && !row.ignored);

  const title =
    options.local && options.remote ? 'Source Tracking Details' : options.local ? 'Local Changes' : 'Remote Changes';
  const output: string[] = [`\n\n${title}\n${'='.repeat(title.length)}`];

  if (remoteChanges.length > 0) {
    output.push(formatChanges(remoteChanges, 'Remote Changes'));
  }

  if (localChanges.length > 0) {
    output.push(formatChanges(localChanges, 'Local Changes'));
  }

  if (conflicts.length > 0) {
    output.push(formatChanges(conflicts, 'Conflicts'));
  }

  if (remoteChanges.length === 0 && localChanges.length === 0 && conflicts.length === 0) {
    output.push('\nNo changes detected');
  }

  yield* channelService.appendToChannel(output.join('\n'));
  yield* Effect.sync(() => channel.show());
});

/** Show detailed source tracking changes in the output channel */
export const showSourceTrackingDetails = async (): Promise<void> =>
  Effect.runPromise(viewChangesEffect({ local: true, remote: true }).pipe(Effect.provide(AllServicesLayer)));

/** Show local changes only in the output channel */
export const viewLocalChanges = async (): Promise<void> =>
  Effect.runPromise(viewChangesEffect({ local: true, remote: false }).pipe(Effect.provide(AllServicesLayer)));

/** Show remote changes only in the output channel */
export const viewRemoteChanges = async (): Promise<void> =>
  Effect.runPromise(viewChangesEffect({ local: false, remote: true }).pipe(Effect.provide(AllServicesLayer)));
