/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgMetadataCatalogChange } from 'salesforcedx-vscode-services';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { coalesceTreeRefreshes, shouldRefreshTreeForCatalogChange } from '../../src/tree/catalogChange';

const operation = (operationName: 'deploy' | 'retrieve' | 'delete'): OrgMetadataCatalogChange => ({
  kind: 'operation',
  event: {
    operation: operationName,
    completedAt: '2026-01-01T00:00:00.000Z',
    changes: []
  }
});

describe('shouldRefreshTreeForCatalogChange', () => {
  it('does not duplicate the retrieve command tree update', () => {
    expect(shouldRefreshTreeForCatalogChange(operation('retrieve'))).toBe(false);
  });

  it.each(['deploy', 'delete'] as const)('refreshes after a %s operation', operationName => {
    expect(shouldRefreshTreeForCatalogChange(operation(operationName))).toBe(true);
  });

  it('refreshes for non-operation catalog changes', () => {
    expect(shouldRefreshTreeForCatalogChange({ kind: 'org', orgId: '00D' })).toBe(true);
  });

  it('coalesces a burst of catalog changes into one tree refresh', async () => {
    const changes: OrgMetadataCatalogChange[] = [
      { kind: 'workspace', events: [] },
      { kind: 'org', orgId: '00D' },
      operation('deploy')
    ];

    const refreshes = await Effect.runPromise(
      coalesceTreeRefreshes(Stream.fromIterable(changes), Duration.millis(1)).pipe(Stream.runCollect)
    );

    expect(Chunk.toReadonlyArray(refreshes)).toEqual([operation('deploy')]);
  });
});
