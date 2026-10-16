/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { hasRetrieveTreeItem } from '../../src/commands/retrieveMetadata';

describe('hasRetrieveTreeItem', () => {
  it('rejects a missing inline-action argument', () => {
    expect(hasRetrieveTreeItem(undefined)).toBe(false);
  });
});
