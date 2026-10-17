/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { apexClassFileBaseName } from '../../../src/utils/apexClassFileCorrelation';

describe('apexClassFileBaseName', () => {
  it('returns the bare class name when fullName is unset', () => {
    expect(apexClassFileBaseName({ name: 'MyTest' })).toBe('MyTest');
  });

  it('returns the bare class name when fullName matches name', () => {
    expect(apexClassFileBaseName({ name: 'MyTest', fullName: 'MyTest' })).toBe('MyTest');
  });

  it('returns the bare class name when fullName is namespace-qualified with a dot', () => {
    expect(apexClassFileBaseName({ name: 'MyTest', fullName: 'MyNs.MyTest' })).toBe('MyTest');
  });

  it('returns the bare class name when fullName uses the sync Namespace__Name form', () => {
    expect(apexClassFileBaseName({ name: 'MyTest', fullName: 'MyNs__MyTest' })).toBe('MyTest');
  });
});
