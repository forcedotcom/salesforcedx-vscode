/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Option from 'effect/Option';
import type { ToolingTestClass } from '../../../src/testDiscovery/schemas';
import { getFullClassName, isFlowTest } from '../../../src/utils/toolingTestClassHelpers';

const classWith = (namespacePrefix: Option.Option<string>, name = 'MyClass'): ToolingTestClass => ({
  id: Option.none(),
  name,
  namespacePrefix,
  testMethods: []
});

describe('isFlowTest', () => {
  it('is true for a bare FlowTesting namespace', () => {
    expect(isFlowTest(classWith(Option.some('FlowTesting')))).toBe(true);
  });

  it('is true for a FlowTesting.<Namespace> prefix', () => {
    expect(isFlowTest(classWith(Option.some('FlowTesting.MyNs')))).toBe(true);
  });

  it('is false for a non-flow Apex namespace', () => {
    expect(isFlowTest(classWith(Option.some('MyNs')))).toBe(false);
  });

  it('is false for a default Apex namespace (absent, post-normalization)', () => {
    expect(isFlowTest(classWith(Option.none()))).toBe(false);
  });
});

describe('getFullClassName', () => {
  it('prefixes the namespace when present', () => {
    expect(getFullClassName(classWith(Option.some('MyNs'), 'Acct'))).toBe('MyNs.Acct');
  });

  it('returns the bare class name when the namespace is absent', () => {
    expect(getFullClassName(classWith(Option.none(), 'Acct'))).toBe('Acct');
  });
});
