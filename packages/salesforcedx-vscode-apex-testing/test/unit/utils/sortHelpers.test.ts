/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import { sortByMtimeAscending } from '../../../src/utils/sortHelpers';

describe('sortByMtimeAscending', () => {
  const uriFor = (runId: string): URI => URI.file(`/results/test-result-${runId}.json`);

  it('orders by mtime so the newest run is applied last (most recent result wins)', () => {
    // Regression: Salesforce test-run-id filenames are NOT chronologically sortable. Here the
    // lexicographically-last file (CrPFqQ) is actually an OLDER run than CrOq5E/CrOtvg. Sorting by
    // filename would apply the older failing run last and clobber the newer passing run. Sorting by
    // mtime applies oldest-first so the newest run wins.
    const items = [
      { uri: uriFor('CrOtvg'), mtime: 4000 }, // newest run (all green)
      { uri: uriFor('CrP6pE'), mtime: 1000 }, // oldest run (had the failure)
      { uri: uriFor('CrPFqQ'), mtime: 2000 }, // lexicographically last, but older than CrO* runs
      { uri: uriFor('CrOq5E'), mtime: 3000 }
    ];

    const ordered = sortByMtimeAscending(items).map(item => item.uri.path);

    expect(ordered).toEqual([
      uriFor('CrP6pE').path,
      uriFor('CrPFqQ').path,
      uriFor('CrOq5E').path,
      uriFor('CrOtvg').path
    ]);
    // The newest-by-mtime run is applied last regardless of filename ordering.
    expect(ordered.at(-1)).toBe(uriFor('CrOtvg').path);
  });

  it('does not mutate the input array', () => {
    const items = [
      { uri: uriFor('b'), mtime: 2000 },
      { uri: uriFor('a'), mtime: 1000 }
    ];
    const snapshot = items.map(i => i.uri.path);
    sortByMtimeAscending(items);
    expect(items.map(i => i.uri.path)).toEqual(snapshot);
  });
});
