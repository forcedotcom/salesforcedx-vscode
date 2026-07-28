/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

/**
 * Close every open text tab whose URI matches `predicate`. No-op when the tab-groups API is
 * unavailable (older hosts) or nothing matches. Shared by any feature that reaps editor tabs backed
 * by transient/virtual documents (e.g. the org-data VFS lifecycle and apex-testing retrieve flow).
 */
export const closeMatchingTabs = Effect.fn('closeMatchingTabs')(function* (predicate: (uri: URI) => boolean) {
  const tabGroups = vscode.window.tabGroups;
  if (!tabGroups) return;
  const tabs = tabGroups.all.flatMap(group =>
    group.tabs.filter(tab => tab.input instanceof vscode.TabInputText && predicate(tab.input.uri))
  );
  if (tabs.length > 0) {
    yield* Effect.promise(() => tabGroups.close(tabs, true));
  }
});
