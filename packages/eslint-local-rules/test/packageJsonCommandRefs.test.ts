/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

describe('package-json-command-refs', () => {
  it('should be exported', () => {
    const { packageJsonCommandRefs } = require('../src/packageJsonCommandRefs');
    expect(packageJsonCommandRefs).toBeDefined();
    expect(packageJsonCommandRefs.meta).toBeDefined();
    expect(packageJsonCommandRefs.meta.type).toBe('problem');
  });
});
