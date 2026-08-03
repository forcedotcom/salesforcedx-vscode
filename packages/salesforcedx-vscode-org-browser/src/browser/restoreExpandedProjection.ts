/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgBrowserNode } from './protocol';
import * as Effect from 'effect/Effect';

type RestoreState = {
  readonly pending: ReadonlySet<string>;
  readonly restoredIds: readonly string[];
  readonly children: ReadonlyMap<string, readonly OrgBrowserNode[]>;
  readonly nodes: ReadonlyMap<string, OrgBrowserNode>;
  readonly madeProgress: boolean;
};

export const restoreExpandedProjection = <E, R>(
  roots: readonly OrgBrowserNode[],
  expandedIds: readonly string[],
  getChildren: (node: OrgBrowserNode) => Effect.Effect<readonly OrgBrowserNode[], E, R>
) =>
  Effect.gen(function* () {
    const initial: RestoreState = {
      pending: new Set(expandedIds),
      restoredIds: [],
      children: new Map(),
      nodes: new Map(roots.map(node => [node.id, node])),
      madeProgress: true
    };
    const restored = yield* Effect.iterate(initial, {
      while: state => state.pending.size > 0 && state.madeProgress,
      body: state => {
        const passInitial: RestoreState = { ...state, madeProgress: false };
        return Effect.reduce(expandedIds, passInitial, (current, nodeId) => {
          if (!current.pending.has(nodeId)) return Effect.succeed(current);
          const node = current.nodes.get(nodeId);
          if (!node) return Effect.succeed(current);
          return getChildren(node).pipe(
            Effect.map(nodeChildren => ({
              pending: new Set([...current.pending].filter(id => id !== nodeId)),
              restoredIds: [...current.restoredIds, nodeId],
              children: new Map(current.children).set(nodeId, nodeChildren),
              nodes: new Map([...current.nodes, ...nodeChildren.map(child => [child.id, child] as const)]),
              madeProgress: true
            }))
          );
        });
      }
    });
    return { expandedIds: restored.restoredIds, children: restored.children, nodes: restored.nodes };
  });
