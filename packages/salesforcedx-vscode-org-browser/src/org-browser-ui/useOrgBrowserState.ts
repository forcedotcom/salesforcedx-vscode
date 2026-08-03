/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StoredViewState } from './types';
import type { OrgBrowserFilterState, OrgBrowserLabels, OrgBrowserNode, OrgBrowserViewState } from '../browser/protocol';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { vscode } from './vscode';

type OrgBrowserState = {
  readonly orgId: string;
  readonly roots: readonly OrgBrowserNode[];
  readonly children: ReadonlyMap<string, readonly OrgBrowserNode[]>;
  readonly expanded: ReadonlySet<string>;
  readonly loading: ReadonlySet<string>;
  readonly globalLoading: boolean;
  readonly selectedId?: string;
  readonly focusedId?: string;
  readonly scrollTop: number;
  readonly filter: OrgBrowserFilterState;
  readonly labels: OrgBrowserLabels;
  readonly filterText: string;
  readonly error?: string;
};

type OrgBrowserActions = {
  readonly setOrgId: React.Dispatch<React.SetStateAction<string>>;
  readonly setRoots: React.Dispatch<React.SetStateAction<readonly OrgBrowserNode[]>>;
  readonly setChildren: React.Dispatch<React.SetStateAction<ReadonlyMap<string, readonly OrgBrowserNode[]>>>;
  readonly setExpanded: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;
  readonly setLoading: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;
  readonly setGlobalLoading: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setSelectedId: React.Dispatch<React.SetStateAction<string | undefined>>;
  readonly setFocusedId: React.Dispatch<React.SetStateAction<string | undefined>>;
  readonly setScrollTop: React.Dispatch<React.SetStateAction<number>>;
  readonly setFilter: React.Dispatch<React.SetStateAction<OrgBrowserFilterState>>;
  readonly setLabels: React.Dispatch<React.SetStateAction<OrgBrowserLabels>>;
  readonly setFilterText: React.Dispatch<React.SetStateAction<string>>;
  readonly setError: React.Dispatch<React.SetStateAction<string | undefined>>;
};

type PersistenceActions = {
  readonly persistState: (overrides?: Partial<OrgBrowserViewState>, debounce?: boolean) => void;
  readonly nextRequestId: () => number;
};

type TimerRefs = {
  readonly filterTimer: React.MutableRefObject<ReturnType<typeof globalThis.setTimeout> | undefined>;
  readonly stateTimer: React.MutableRefObject<ReturnType<typeof globalThis.setTimeout> | undefined>;
  readonly initialPaintFrame: React.MutableRefObject<number | undefined>;
  readonly initialDataFrame: React.MutableRefObject<number | undefined>;
  readonly initialDataRequested: React.MutableRefObject<boolean>;
};

type StateRefs = {
  readonly generationReference: React.MutableRefObject<number>;
  readonly expandedReference: React.MutableRefObject<ReadonlySet<string>>;
  readonly selectedReference: React.MutableRefObject<string | undefined>;
  readonly focusedReference: React.MutableRefObject<string | undefined>;
  readonly scrollReference: React.MutableRefObject<number>;
};

const readStoredState = (): StoredViewState => {
  const stored = vscode.getState();
  return stored?.version === 1 ? stored : { version: 1, byOrg: {} };
};

export const useOrgBrowserState = (defaultLabels: OrgBrowserLabels, emptyFilter: OrgBrowserFilterState) => {
  const [orgId, setOrgId] = useState('');
  const [roots, setRoots] = useState<readonly OrgBrowserNode[]>([]);
  const [children, setChildren] = useState<ReadonlyMap<string, readonly OrgBrowserNode[]>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const [globalLoading, setGlobalLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  const [scrollTop, setScrollTop] = useState(0);
  const [filter, setFilter] = useState(emptyFilter);
  const [labels, setLabels] = useState(defaultLabels);
  const [filterText, setFilterText] = useState('');
  const [error, setError] = useState<string>();

  const requestId = useRef(0);
  const generationReference = useRef(0);
  const expandedReference = useRef<ReadonlySet<string>>(new Set());
  const selectedReference = useRef<string | undefined>(undefined);
  const focusedReference = useRef<string | undefined>(undefined);
  const scrollReference = useRef(0);
  const filterTimer = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);
  const stateTimer = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(undefined);
  const initialPaintFrame = useRef<number | undefined>(undefined);
  const initialDataFrame = useRef<number | undefined>(undefined);
  const initialDataRequested = useRef(false);

  const nextRequestId = useCallback((): number => {
    requestId.current += 1;
    return requestId.current;
  }, []);

  const persistState = useCallback(
    (overrides: Partial<OrgBrowserViewState> = {}, debounce = false): void => {
      if (!orgId) return;
      const viewState: OrgBrowserViewState = {
        version: 1,
        expandedIds: [...expandedReference.current],
        selectedId: selectedReference.current,
        focusedId: focusedReference.current,
        scrollTop: scrollReference.current,
        ...overrides
      };
      const stored = readStoredState();
      vscode.setState({ ...stored, byOrg: { ...stored.byOrg, [orgId]: viewState } });
      if (stateTimer.current) globalThis.clearTimeout(stateTimer.current);
      if (!debounce) {
        vscode.postMessage({ type: 'setViewState', generation: generationReference.current, orgId, state: viewState });
        return;
      }
      stateTimer.current = globalThis.setTimeout(() => {
        vscode.postMessage({ type: 'setViewState', generation: generationReference.current, orgId, state: viewState });
      }, 100);
    },
    [orgId]
  );

  useEffect(
    () => () => {
      if (filterTimer.current) globalThis.clearTimeout(filterTimer.current);
      if (stateTimer.current) globalThis.clearTimeout(stateTimer.current);
      if (initialPaintFrame.current !== undefined) globalThis.cancelAnimationFrame(initialPaintFrame.current);
      if (initialDataFrame.current !== undefined) globalThis.cancelAnimationFrame(initialDataFrame.current);
    },
    []
  );

  const state: OrgBrowserState = {
    orgId,
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
  };

  const actions: OrgBrowserActions = {
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
  };

  const persistence: PersistenceActions = {
    persistState,
    nextRequestId
  };

  const timers: TimerRefs = {
    filterTimer,
    stateTimer,
    initialPaintFrame,
    initialDataFrame,
    initialDataRequested
  };

  const refs: StateRefs = {
    generationReference,
    expandedReference,
    selectedReference,
    focusedReference,
    scrollReference
  };

  return { state, actions, persistence, timers, refs };
};
