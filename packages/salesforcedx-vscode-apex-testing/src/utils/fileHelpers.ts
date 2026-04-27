/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QuickPickItem } from 'vscode';

type TestType = 'All' | 'AllLocal' | 'Suite' | 'Class';

export type ApexTestQuickPickItem = QuickPickItem & {
  type: TestType;
  /** When set, used as the class name for the run payload (e.g. namespaced "ns.MyTest"); label is for display only. */
  fullClassName?: string;
};
