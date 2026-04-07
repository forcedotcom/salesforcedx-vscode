/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as HashSet from 'effect/HashSet';
import type { HashableUri } from 'salesforcedx-vscode-services';

/** Returns the subset of allJsonUris that are stale — i.e., no component from that file
 * appears as the winning (first) row for any key in byKey. */
export const getStaleUris = (
  byKey: Partial<Record<string, readonly { readonly sourceUri: HashableUri }[]>>,
  allJsonUris: HashSet.HashSet<HashableUri>
): HashSet.HashSet<HashableUri> => {
  const winningUris = HashSet.fromIterable(
    Object.values(byKey)
      .filter((rows): rows is readonly { readonly sourceUri: HashableUri }[] => rows !== undefined)
      .map(rows => rows[0].sourceUri)
  );
  return HashSet.difference(allJsonUris, winningUris);
};
