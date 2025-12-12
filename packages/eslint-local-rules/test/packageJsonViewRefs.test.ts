/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

describe('package-json-view-refs', () => {
  it('should be exported', () => {
    const { packageJsonViewRefs } = require('../src/packageJsonViewRefs');
    expect(packageJsonViewRefs).toBeDefined();
    expect(packageJsonViewRefs.meta).toBeDefined();
    expect(packageJsonViewRefs.meta.type).toBe('problem');
  });
});
