/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';

const formatChanges = (changes: StatusOutputRow[], sectionTitle: string): string => {
  const lines = [`\n${sectionTitle} (${changes.length}):\n${'='.repeat(sectionTitle.length + 5)}`];
  changes.forEach(row => {
    lines.push(`  ${String(row.type)}: ${String(row.fullName)}`);
  });
  return lines.join('\n');
};

/** Show detailed source tracking changes in the output channel */
export const showSourceTrackingDetails = async (): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const channelService = yield* api.services.ChannelService;
      const channel = yield* channelService.getChannel;
      const tracking = yield* Effect.flatMap(api.services.SourceTrackingService, svc => svc.getSourceTracking());

      if (!tracking) {
        yield* channelService.appendToChannel('No source tracking available for this org');
        return;
      }

      yield* Effect.promise(() => tracking.reReadLocalTrackingCache());
      const status = yield* Effect.tryPromise(() => tracking.getStatus({ local: true, remote: true }));

      const remoteChanges = status.filter(row => row.origin === 'remote' && !row.conflict && !row.ignored);
      const localChanges = status.filter(row => row.origin === 'local' && !row.conflict && !row.ignored);
      const conflicts = status.filter(row => row.conflict && !row.ignored);

      const output: string[] = [`\n\nSource Tracking Details\n${'='.repeat(23)}`];

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
    }).pipe(Effect.withSpan('showSourceTrackingDetails'), Effect.provide(AllServicesLayer))
  );
