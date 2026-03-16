/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { refreshSObjectsCommand, SOBJECT_REFRESH_COMPLETE_CMD } from '../../../src/commands/refreshSObjects';

describe('refreshSObjects module', () => {
  it('exports refreshSObjectsCommand', () => {
    expect(refreshSObjectsCommand).toBeDefined();
    expect(typeof refreshSObjectsCommand).toBe('function');
  });

  it('exports the correct completion command ID', () => {
    expect(SOBJECT_REFRESH_COMPLETE_CMD).toBe('sf.internal.sobjectrefresh.complete');
  });
});
