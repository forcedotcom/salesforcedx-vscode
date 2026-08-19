/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Duration from 'effect/Duration';
import * as Stream from 'effect/Stream';
import type { OrgMetadataCatalogChange } from 'salesforcedx-vscode-services';

/**
 * Retrieve commands update their affected tree row when they complete. A second,
 * catalog-wide refresh invalidates VS Code's inline action context for that row.
 */
export const shouldRefreshTreeForCatalogChange = (change: OrgMetadataCatalogChange): boolean =>
  change.kind !== 'operation' || change.event.operation !== 'retrieve';

export const coalesceTreeRefreshes = <E, R>(
  changes: Stream.Stream<OrgMetadataCatalogChange, E, R>,
  quietPeriod: Duration.DurationInput = Duration.millis(500)
): Stream.Stream<OrgMetadataCatalogChange, E, R> =>
  changes.pipe(Stream.filter(shouldRefreshTreeForCatalogChange), Stream.debounce(quietPeriod));
