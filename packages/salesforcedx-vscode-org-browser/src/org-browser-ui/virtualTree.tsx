/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FlatNode } from './types';
import type { OrgBrowserLabels, OrgBrowserNode } from '../browser/protocol';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type KeyboardEvent, type ReactElement, useEffect, useMemo, useRef } from 'react';

const ROW_HEIGHT = 24;

const flattenNodes = (
  roots: readonly OrgBrowserNode[],
  children: ReadonlyMap<string, readonly OrgBrowserNode[]>,
  expanded: ReadonlySet<string>
): readonly FlatNode[] => {
  const flattened: FlatNode[] = [];
  const visit = (nodes: readonly OrgBrowserNode[], level: number): void => {
    nodes.forEach((node, index) => {
      flattened.push({ node, level, position: index + 1, setSize: nodes.length });
      if (expanded.has(node.id)) visit(children.get(node.id) ?? [], level + 1);
    });
  };
  visit(roots, 1);
  return flattened;
};

const presenceDescription = (node: OrgBrowserNode, labels: OrgBrowserLabels): string => {
  switch (node.presence) {
    case 'both':
      return labels.presenceBoth;
    case 'local':
      return labels.presenceLocal;
    case 'org':
      return labels.presenceOrg;
  }
};

type VirtualTreeProperties = {
  readonly labels: OrgBrowserLabels;
  readonly roots: readonly OrgBrowserNode[];
  readonly children: ReadonlyMap<string, readonly OrgBrowserNode[]>;
  readonly expanded: ReadonlySet<string>;
  readonly loading: ReadonlySet<string>;
  readonly selectedId?: string;
  readonly focusedId?: string;
  readonly scrollTop: number;
  readonly onToggle: (node: OrgBrowserNode) => void;
  readonly onSelect: (nodeId: string) => void;
  readonly onFocus: (nodeId: string) => void;
  readonly onScroll: (scrollTop: number) => void;
  readonly onRetrieve: (nodeId: string) => void;
  readonly onRefresh: (nodeId: string) => void;
};

const CloudDownloadIcon = (): ReactElement => (
  <svg aria-hidden="true" className="row-action-icon" viewBox="0 0 16 16">
    <path d="M9.015 12.072V7h-.994v5.122l-1.03-1.037-.703.707 1.503 1.512.751.756.703-.707 1.503-1.513-.751-.756-.982.988Z" />
    <path d="M12.006 6h-.05a3.5 3.5 0 0 0-6.635-.9A3.5 3.5 0 1 0 4.523 12h.499v-1h-.499a2.5 2.5 0 1 1 .567-4.927l.808.189.333-.762a2.5 2.5 0 0 1 4.738.643l.124.857h.913a2 2 0 1 1 0 4v1a3 3 0 1 0 0-6Z" />
  </svg>
);

export const VirtualTree = (properties: VirtualTreeProperties): ReactElement => {
  const { roots, children, expanded, loading, selectedId, focusedId, scrollTop } = properties;
  const viewportRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef('');
  const typeaheadTimer = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);
  const rows = useMemo(() => flattenNodes(roots, children, expanded), [children, expanded, roots]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport && Math.abs(viewport.scrollTop - scrollTop) > 1) viewport.scrollTop = scrollTop;
  }, [scrollTop]);

  useEffect(() => {
    if (!focusedId && rows[0]) properties.onFocus(rows[0].node.id);
  }, [focusedId, properties, rows]);

  useEffect(
    () => () => {
      if (typeaheadTimer.current) globalThis.clearTimeout(typeaheadTimer.current);
    },
    []
  );

  const focusRow = (index: number): void => {
    const target = rows[index];
    if (!target) return;
    properties.onFocus(target.node.id);
    virtualizer.scrollToIndex(index, { align: 'auto' });
    globalThis.requestAnimationFrame(() => {
      viewportRef.current?.querySelector<HTMLElement>(`[data-node-index="${index}"]`)?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number): void => {
    const current = rows[index];
    if (!current) return;
    let targetIndex: number | undefined;
    switch (event.key) {
      case 'ArrowDown':
        targetIndex = Math.min(rows.length - 1, index + 1);
        break;
      case 'ArrowUp':
        targetIndex = Math.max(0, index - 1);
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = rows.length - 1;
        break;
      case 'ArrowRight':
        if (current.node.expandable && !expanded.has(current.node.id)) properties.onToggle(current.node);
        else if (expanded.has(current.node.id)) targetIndex = index + 1;
        break;
      case 'ArrowLeft':
        if (expanded.has(current.node.id)) properties.onToggle(current.node);
        else if (current.node.parentId) targetIndex = rows.findIndex(row => row.node.id === current.node.parentId);
        break;
      case 'Enter':
      case ' ':
        properties.onSelect(current.node.id);
        if (current.node.expandable) properties.onToggle(current.node);
        break;
      default:
        if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
        if (typeaheadTimer.current) globalThis.clearTimeout(typeaheadTimer.current);
        typeahead.current = `${typeahead.current}${event.key}`.toLocaleLowerCase();
        typeaheadTimer.current = globalThis.setTimeout(() => {
          typeahead.current = '';
        }, 700);
        targetIndex = [...rows.slice(index + 1), ...rows.slice(0, index + 1)].findIndex(row =>
          row.node.label.toLocaleLowerCase().startsWith(typeahead.current)
        );
        if (targetIndex >= 0) targetIndex = (index + 1 + targetIndex) % rows.length;
    }
    event.preventDefault();
    event.stopPropagation();
    if (targetIndex !== undefined && targetIndex >= 0) focusRow(targetIndex);
  };

  return (
    <div
      aria-label={properties.labels.tree}
      className="tree"
      id="org-browser-tree"
      onScroll={event => properties.onScroll(event.currentTarget.scrollTop)}
      ref={viewportRef}
      role="tree"
    >
      <div className="tree-window" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          const { node } = row;
          const isExpanded = expanded.has(node.id);
          const isSelected = selectedId === node.id;
          const isFocused = focusedId === node.id;
          const isLoading = loading.has(node.id);
          const presence = presenceDescription(node, properties.labels);
          return (
            <div
              aria-busy={isLoading || undefined}
              aria-expanded={node.expandable ? isExpanded : undefined}
              aria-level={row.level}
              aria-label={node.label}
              aria-posinset={row.position}
              aria-selected={isSelected}
              aria-setsize={row.setSize}
              className={`tree-row${isSelected ? ' selected' : ''}`}
              data-node-id={node.id}
              data-node-index={virtualRow.index}
              key={node.id}
              onClick={() => {
                properties.onSelect(node.id);
                if (node.expandable) properties.onToggle(node);
              }}
              onFocus={() => properties.onFocus(node.id)}
              onKeyDown={event => handleKeyDown(event, virtualRow.index)}
              role="treeitem"
              style={{
                height: virtualRow.size,
                paddingLeft: (row.level - 1) * 14 + 4,
                transform: `translateY(${virtualRow.start}px)`
              }}
              tabIndex={isFocused ? 0 : -1}
              title={`${node.label} — ${presence}`}
            >
              <span aria-hidden="true" className="twistie">
                {isLoading ? <span className="busy-indicator" /> : node.expandable ? isExpanded ? '▾' : '▸' : ''}
              </span>
              <span aria-label={presence} className="presence-accessible" role="img">
                {presence}
              </span>
              <span className={`node-label${node.presence === 'org' ? ' is-org-only' : ''}`}>{node.label}</span>
              <span className="row-actions">
                {node.actions.includes('refresh') && (
                  <button
                    aria-label={`${properties.labels.refresh} ${node.label}`}
                    data-action="refresh"
                    onClick={event => {
                      event.stopPropagation();
                      properties.onRefresh(node.id);
                    }}
                    title={properties.labels.refresh}
                    type="button"
                  >
                    ↻
                  </button>
                )}
                {node.actions.includes('retrieve') && (
                  <button
                    aria-label={`${properties.labels.retrieve} ${node.label}`}
                    data-action="retrieve"
                    onClick={event => {
                      event.stopPropagation();
                      properties.onRetrieve(node.id);
                    }}
                    title={properties.labels.retrieve}
                    type="button"
                  >
                    <CloudDownloadIcon />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
