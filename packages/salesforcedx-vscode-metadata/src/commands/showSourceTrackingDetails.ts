/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import { nls } from '../messages';
import { separateChanges } from '../statusBar/helpers';

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

export const viewChangesCommand = Effect.fn('viewChanges')(function* (options: ViewChangesOptions) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const channel = yield* channelService.getChannel;
  const tracking = yield* api.services.SourceTrackingService.getSourceTrackingOrThrow();

  // Re-read both remote and local tracking to ensure fresh data
  yield* Effect.all(
    [
      ...(options.remote ? [Effect.promise(() => tracking.reReadRemoteTracking())] : []),
      ...(options.local ? [Effect.promise(() => tracking.reReadLocalTrackingCache())] : [])
    ],
    { concurrency: 'unbounded' }
  );
  const status = yield* Effect.promise(() => tracking.getStatus(options));
  const { localChanges: allLocalChanges, remoteChanges: allRemoteChanges, conflicts } = separateChanges(status);

  const remoteChanges = options.remote ? allRemoteChanges : undefined;
  const localChanges = options.local ? allLocalChanges : undefined;

  const title =
    options.local && options.remote
      ? nls.localize('source_tracking_title_all_changes')
      : options.local
        ? nls.localize('source_tracking_title_local_changes')
        : nls.localize('source_tracking_title_remote_changes');

  const output = [
    '',
    `${title}:`,
    formatChanges(remoteChanges, nls.localize('source_tracking_section_remote_changes')),
    formatChanges(localChanges, nls.localize('source_tracking_section_local_changes')),
    formatChanges(conflicts, nls.localize('source_tracking_section_conflicts'))
  ].join('\n');

  yield* channelService.appendToChannel(output);
  yield* Effect.sync(() => channel.show());
});
