/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgBrowserTreeItem } from './orgBrowserNode';

/** Type for MetadataTypeTreeProvider to avoid circular dependencies */
export type MetadataTypeTreeProvider = {
  readonly fireChangeEvent: (node?: OrgBrowserTreeItem) => void;
};
