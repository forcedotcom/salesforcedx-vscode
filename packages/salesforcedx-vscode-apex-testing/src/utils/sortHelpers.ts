/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Returns the items sorted oldest-first by mtime, without mutating the input.
 * Apex test-result filenames embed Salesforce test-run IDs, which are NOT
 * chronologically sortable, so alphabetical (filename) order can disagree with
 * run order. Consumers apply results oldest-first so the most recent run wins;
 * sorting by mtime keeps that ordering correct.
 */
export const sortByMtimeAscending = <T extends { mtime: number }>(items: readonly T[]): T[] =>
  items.toSorted((a, b) => a.mtime - b.mtime);
