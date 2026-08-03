/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgBrowserNode, OrgBrowserViewState } from '../browser/protocol';

export type StoredViewState = {
  readonly version: 1;
  readonly byOrg: Readonly<Record<string, OrgBrowserViewState>>;
};

export type FlatNode = {
  readonly node: OrgBrowserNode;
  readonly level: number;
  readonly position: number;
  readonly setSize: number;
};
