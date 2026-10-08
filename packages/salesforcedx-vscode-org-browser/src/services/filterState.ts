/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as vscode from 'vscode';

export type OrgBrowserFilterState = {
  readonly typeFilter: string | undefined;
  readonly componentFilter: string | undefined;
  readonly typeIsRegex: boolean;
  readonly componentIsRegex: boolean;
  readonly showLocal: boolean;
  readonly showOrg: boolean;
};

const FILTER_STATE_KEY = 'orgBrowser.filtersByOrg';

const defaultFilterState: OrgBrowserFilterState = {
  typeFilter: undefined,
  componentFilter: undefined,
  typeIsRegex: false,
  componentIsRegex: false,
  showLocal: true,
  showOrg: true
};

export const getFilterState = (context: vscode.ExtensionContext, orgId: string): OrgBrowserFilterState | undefined =>
  (() => {
    const filter =
      context.workspaceState.get<Record<string, Partial<OrgBrowserFilterState>>>(FILTER_STATE_KEY)?.[orgId];
    return filter ? { ...defaultFilterState, ...filter } : undefined;
  })();

export const saveFilterState = (
  context: vscode.ExtensionContext,
  orgId: string,
  filter: Partial<OrgBrowserFilterState>
): Thenable<void> =>
  context.workspaceState.update(FILTER_STATE_KEY, {
    ...context.workspaceState.get<Record<string, Partial<OrgBrowserFilterState>>>(FILTER_STATE_KEY),
    [orgId]: { ...getFilterState(context, orgId), ...filter }
  });
