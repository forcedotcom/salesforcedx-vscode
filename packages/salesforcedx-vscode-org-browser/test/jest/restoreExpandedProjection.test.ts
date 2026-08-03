/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { OrgBrowserNode } from '../../src/browser/protocol';
import { restoreExpandedProjection } from '../../src/browser/restoreExpandedProjection';

const node = (id: string, parentId?: string): OrgBrowserNode => ({
  id,
  ...(parentId ? { parentId } : {}),
  kind: id.startsWith('type:') ? 'type' : 'customObject',
  label: id,
  xmlName: 'CustomObject',
  fullName: parentId ? id : undefined,
  expandable: true,
  presence: 'org',
  actions: ['refresh', 'retrieve']
});

describe('restoreExpandedProjection', () => {
  it('restores nested expansions parent-first regardless of persisted order', async () => {
    const type = node('type:CustomObject');
    const object = node('customObject:CustomObject:Broker__c', type.id);
    const getChildren = jest.fn((parent: OrgBrowserNode) => Effect.succeed(parent.id === type.id ? [object] : []));

    const restored = await Effect.runPromise(
      restoreExpandedProjection([type], [object.id, type.id, 'missing-node'], getChildren)
    );

    expect(restored.expandedIds).toEqual([type.id, object.id]);
    expect(restored.children.get(type.id)).toEqual([object]);
    expect(restored.children.get(object.id)).toEqual([]);
    expect(getChildren.mock.calls.map(([parent]) => parent.id)).toEqual([type.id, object.id]);
  });
});
