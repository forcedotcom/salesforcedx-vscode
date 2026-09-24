/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { classifyOrgForTelemetry } from '../../../src/helpers/classifyOrgForTelemetry';

describe('classifyOrgForTelemetry', () => {
  it.each([
    ['stg9402s', 'gov'],
    ['usa9001', 'gov'],
    ['usa9102', 'nonGov']
  ] as const)('classifies %s as %s', (instanceName, expected) => {
    expect(classifyOrgForTelemetry('00D', instanceName)).toBe(expected);
  });

  it('requires an org and instance name', () => {
    expect(classifyOrgForTelemetry(undefined, 'usa9001')).toBe('unknown');
    expect(classifyOrgForTelemetry('00D', undefined)).toBe('unknown');
  });
});
