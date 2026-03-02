/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as decorations from '../../../src/codecoverage/decorations';

describe('codecoverage decorations', () => {
  it('should export covered and uncovered decoration types', () => {
    expect('coveredLinesDecorationType' in decorations).toBe(true);
    expect('uncoveredLinesDecorationType' in decorations).toBe(true);
  });
});
