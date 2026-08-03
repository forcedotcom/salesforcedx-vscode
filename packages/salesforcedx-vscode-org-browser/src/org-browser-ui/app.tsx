/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  OrgBrowserFilterState,
  OrgBrowserHostMessage,
  OrgBrowserLabels,
  OrgBrowserNode,
  OrgBrowserViewState
} from '../browser/protocol';
import { type ChangeEvent, type ReactElement, useCallback, useEffect } from 'react';
import { useOrgBrowserState } from './useOrgBrowserState';
import { VirtualTree } from './virtualTree';
import { vscode } from './vscode';

const EMPTY_FILTER: OrgBrowserFilterState = {
  showLocal: true,
  showOrg: true,
  text: '',
  typeFilter: undefined,
  componentFilter: undefined,
  typeIsRegex: false,
  componentIsRegex: false
};
const DEFAULT_LABELS: OrgBrowserLabels = {
  local: 'Local',
  org: 'Org',
  filter: 'Filter metadata',
  filterPlaceholder: 'Filter: Apex*, *:*Test* (wildcards) or /Apex.*/:/.*(Test|Spec)/ (regex)',
  clearFilter: 'Clear filter',
  refresh: 'Refresh',
  refreshAll: 'Refresh All',
  retrieve: 'Retrieve',
  collapseAll: 'Collapse All',
  loading:
    'Retrieving the metadata types from your org. This might take a bit.\n\nExpand a metadata type to see its components. You can retrieve an individual component or all visible components of a type.',
  empty: 'No metadata is available.\n\nUse Refresh All to retrieve the latest metadata types from your org.',
  filteredEmpty:
    'No metadata types match your current filters.\n\nAdjust the Local, Org, or type/component filter controls above to view metadata.',
  presenceEmpty: 'Both presence filters are off.\n\nEnable Local or Org above to view metadata.',
  tree: 'Org metadata',
  controls: 'Org Browser controls',
  presenceBoth: 'Present in the org and local project',
  presenceLocal: 'Present only in the local project',
  presenceOrg: 'Present only in the org'
};

const CollapseAllIcon = (): ReactElement => (
  <svg aria-hidden="true" className="toolbar-action-icon" viewBox="0 0 16 16">
    <path d="M14 4.27051C14.5999 4.62053 15 5.26009 15 6V11C15 13.21 13.21 15 11 15H6C5.26009 15 4.62053 14.5999 4.27051 14H11C12.65 14 14 12.65 14 11V4.27051Z" />
    <path d="M9.5 7C9.776 7 10 7.224 10 7.5C10 7.776 9.776 8 9.5 8H5.5C5.224 8 5 7.776 5 7.5C5 7.224 5.224 7 5.5 7H9.5Z" />
    <path
      clipRule="evenodd"
      d="M11 2C12.103 2 13 2.897 13 4V11C13 12.103 12.103 13 11 13H4C2.897 13 2 12.103 2 11V4C2 2.897 2.897 2 4 2H11ZM4 3C3.449 3 3 3.449 3 4V11C3 11.552 3.449 12 4 12H11C11.551 12 12 11.552 12 11V4C12 3.449 11.551 3 11 3H4Z"
      fillRule="evenodd"
    />
  </svg>
);

export const App = (): ReactElement => {
  const { state, actions, persistence, timers, refs } = useOrgBrowserState(DEFAULT_LABELS, EMPTY_FILTER);
  const {
    roots,
    children,
    expanded,
    loading,
    globalLoading,
    selectedId,
    focusedId,
    scrollTop,
    filter,
    labels,
    filterText,
    error
  } = state;
  const {
    setOrgId,
    setRoots,
    setChildren,
    setExpanded,
    setLoading,
    setGlobalLoading,
    setSelectedId,
    setFocusedId,
    setScrollTop,
    setFilter,
    setLabels,
    setFilterText,
    setError
  } = actions;
  const { persistState, nextRequestId } = persistence;
  const { filterTimer, initialPaintFrame, initialDataFrame, initialDataRequested } = timers;
  const { generationReference, expandedReference, selectedReference, focusedReference, scrollReference } = refs;

  useEffect(() => {
    const listener = (event: MessageEvent<OrgBrowserHostMessage>): void => {
      const message = event.data;
      switch (message.type) {
        case 'configure':
          setLabels(message.labels);
          if (!initialDataRequested.current) {
            initialDataRequested.current = true;
            initialPaintFrame.current = globalThis.requestAnimationFrame(() => {
              initialDataFrame.current = globalThis.requestAnimationFrame(() => {
                vscode.postMessage({ type: 'requestInitialData' });
              });
            });
          }
          return;
        case 'initialize': {
          const stored = vscode.getState();
          const storedState = stored?.version === 1 ? stored : { version: 1 as const, byOrg: {} };
          const byOrg: Record<string, OrgBrowserViewState> = storedState.byOrg;
          const restored = message.viewState ?? byOrg[message.orgId];
          setOrgId(message.orgId);
          generationReference.current = message.generation;
          setFilter(message.filter);
          setLabels(message.labels);
          setFilterText(message.filter.text);
          setRoots(message.roots);
          setChildren(() => new Map((message.children ?? []).map(child => [child.parentId, child.nodes])));
          const restoredExpanded = new Set<string>(restored?.expandedIds);
          expandedReference.current = restoredExpanded;
          selectedReference.current = restored?.selectedId;
          focusedReference.current = restored?.focusedId;
          scrollReference.current = restored?.scrollTop ?? 0;
          setExpanded(restoredExpanded);
          setSelectedId(restored?.selectedId);
          setFocusedId(restored?.focusedId);
          setScrollTop(restored?.scrollTop ?? 0);
          setGlobalLoading(false);
          setError(undefined);
          if (message.viewState) {
            vscode.setState({
              version: 1 as const,
              byOrg: { ...storedState.byOrg, [message.orgId]: message.viewState }
            });
          }
          // Auto-expand restored nodes on next tick to allow UI to render first
          if (restoredExpanded.size > 0) {
            globalThis.setTimeout(() => {
              restoredExpanded.forEach(nodeId => {
                vscode.postMessage({
                  type: 'expand',
                  generation: message.generation,
                  requestId: nextRequestId(),
                  nodeId
                });
              });
            }, 0);
          }
          return;
        }
        case 'roots':
          if (message.generation !== generationReference.current) return;
          setRoots(message.nodes);
          setChildren(() => new Map());
          setFilter(message.filter);
          return;
        case 'children':
          if (message.generation !== generationReference.current) return;
          setChildren(current => new Map(current).set(message.parentId, message.nodes));
          return;
        case 'loading':
          if (!message.nodeId) {
            setGlobalLoading(message.loading);
            return;
          }
          setLoading(current => {
            const next = new Set(current);
            if (message.loading) next.add(message.nodeId!);
            else next.delete(message.nodeId!);
            return next;
          });
          return;
        case 'error':
          setLoading(() => new Set());
          setGlobalLoading(false);
          setError(message.message);
          return;
        case 'collapseAll':
          expandedReference.current = new Set();
          setExpanded(new Set());
          persistState({ expandedIds: [] });
          return;
        case 'focusFilter':
          document.querySelector<HTMLInputElement>('[data-filter-input]')?.focus();
      }
    };
    globalThis.addEventListener('message', listener);
    vscode.postMessage({ type: 'ready' });
    return () => globalThis.removeEventListener('message', listener);
  }, []);

  const sendFilter = (showLocal: boolean, showOrg: boolean, text: string): void => {
    vscode.postMessage({
      type: 'setFilter',
      generation: generationReference.current,
      requestId: nextRequestId(),
      showLocal,
      showOrg,
      text
    });
  };

  const changeFilterText = (event: ChangeEvent<HTMLInputElement>): void => {
    const text = event.currentTarget.value;
    setFilterText(text);
    if (filterTimer.current) globalThis.clearTimeout(filterTimer.current);
    filterTimer.current = globalThis.setTimeout(() => sendFilter(filter.showLocal, filter.showOrg, text), 150);
  };

  const togglePresence = (kind: 'local' | 'org', checked: boolean): void => {
    const nextShowLocal = kind === 'local' ? checked : filter.showLocal;
    const nextShowOrg = kind === 'org' ? checked : filter.showOrg;
    setFilter({ ...filter, showLocal: nextShowLocal, showOrg: nextShowOrg });
    sendFilter(nextShowLocal, nextShowOrg, filterText);
  };

  const toggleNode = useCallback(
    (node: OrgBrowserNode): void => {
      setExpanded((current: ReadonlySet<string>) => {
        const next = new Set<string>(current);
        if (next.has(node.id)) next.delete(node.id);
        else {
          next.add(node.id);
          vscode.postMessage({
            type: 'expand',
            generation: generationReference.current,
            requestId: nextRequestId(),
            nodeId: node.id
          });
        }
        expandedReference.current = next;
        globalThis.queueMicrotask(() => persistState({ expandedIds: [...next] }));
        return next;
      });
    },
    [persistState, nextRequestId]
  );

  const selectNode = (nodeId: string): void => {
    selectedReference.current = nodeId;
    setSelectedId(nodeId);
    persistState({ selectedId: nodeId });
  };

  const focusNode = useCallback(
    (nodeId: string): void => {
      focusedReference.current = nodeId;
      setFocusedId(nodeId);
      persistState({ focusedId: nodeId });
    },
    [persistState]
  );

  const updateScroll = (nextScrollTop: number): void => {
    scrollReference.current = nextScrollTop;
    setScrollTop(nextScrollTop);
    persistState({ scrollTop: nextScrollTop }, true);
  };

  const emptyMessage =
    !filter.showLocal && !filter.showOrg ? labels.presenceEmpty : filter.text ? labels.filteredEmpty : labels.empty;

  return (
    <main aria-busy={globalLoading} className="app">
      <div aria-label={labels.controls} className="toolbar" role="toolbar">
        <label>
          <input
            checked={filter.showLocal}
            onChange={event => togglePresence('local', event.currentTarget.checked)}
            type="checkbox"
          />{' '}
          {labels.local}
        </label>
        <label>
          <input
            checked={filter.showOrg}
            onChange={event => togglePresence('org', event.currentTarget.checked)}
            type="checkbox"
          />{' '}
          {labels.org}
        </label>
        <div className="filter-box">
          <input
            aria-label={labels.filter}
            data-filter-input
            onChange={changeFilterText}
            placeholder={labels.filterPlaceholder}
            title={labels.filterPlaceholder}
            type="search"
            value={filterText}
          />
          <button
            aria-label={labels.clearFilter}
            disabled={!filterText}
            onClick={() => {
              setFilterText('');
              sendFilter(filter.showLocal, filter.showOrg, '');
            }}
            title={labels.clearFilter}
            type="button"
          >
            ×
          </button>
        </div>
        <button
          aria-label={labels.refreshAll}
          disabled={globalLoading}
          onClick={() =>
            vscode.postMessage({ type: 'refresh', generation: generationReference.current, requestId: nextRequestId() })
          }
          title={labels.refreshAll}
          type="button"
        >
          ↻
        </button>
        <button
          aria-label={labels.collapseAll}
          onClick={() => {
            expandedReference.current = new Set();
            setExpanded(new Set());
            persistState({ expandedIds: [] });
          }}
          title={labels.collapseAll}
          type="button"
        >
          <CollapseAllIcon />
        </button>
      </div>
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
      {!error && globalLoading && (
        <div className="message" role="status">
          {labels.loading}
        </div>
      )}
      {!error && !globalLoading && roots.length === 0 && (
        <div className="message" role="status">
          {emptyMessage}
        </div>
      )}
      {!error && !globalLoading && roots.length > 0 && (
        <VirtualTree
          children={children}
          expanded={expanded}
          focusedId={focusedId}
          labels={labels}
          loading={loading}
          onFocus={focusNode}
          onRefresh={nodeId =>
            vscode.postMessage({
              type: 'refresh',
              generation: generationReference.current,
              requestId: nextRequestId(),
              nodeId
            })
          }
          onRetrieve={nodeId =>
            vscode.postMessage({
              type: 'retrieve',
              generation: generationReference.current,
              requestId: nextRequestId(),
              nodeId
            })
          }
          onScroll={updateScroll}
          onSelect={selectNode}
          onToggle={toggleNode}
          roots={roots}
          scrollTop={scrollTop}
          selectedId={selectedId}
        />
      )}
    </main>
  );
};
