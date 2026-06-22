/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { toOrgChange } from '../../src/owned/orgChangeMapper';
import type { ChangeResult } from '@salesforce/source-tracking';

describe('toOrgChange', () => {
  it('maps a ChangeResult with single filename to OrgChange', () => {
    const change: ChangeResult = {
      name: 'MyClass',
      type: 'ApexClass',
      origin: 'remote',
      filenames: ['/path/to/MyClass.cls']
    };
    expect(toOrgChange(change)).toEqual({
      fullName: 'MyClass',
      type: 'ApexClass',
      state: 'remote',
      filePath: '/path/to/MyClass.cls'
    });
  });

  it('maps a ChangeResult with multiple filenames to OrgChange using first file', () => {
    const change: ChangeResult = {
      name: 'MyClass',
      type: 'ApexClass',
      origin: 'local',
      filenames: ['/path/to/MyClass.cls', '/path/to/MyClass.cls-meta.xml']
    };
    expect(toOrgChange(change)).toEqual({
      fullName: 'MyClass',
      type: 'ApexClass',
      state: 'local',
      filePath: '/path/to/MyClass.cls'
    });
  });

  it('maps a ChangeResult with no filenames to OrgChange without filePath', () => {
    const change: ChangeResult = {
      name: 'MyClass',
      type: 'ApexClass',
      origin: 'remote'
    };
    expect(toOrgChange(change)).toEqual({
      fullName: 'MyClass',
      type: 'ApexClass',
      state: 'remote'
    });
  });

  it('maps a ChangeResult with empty filenames array to OrgChange without filePath', () => {
    const change: ChangeResult = {
      name: 'MyClass',
      type: 'ApexClass',
      origin: 'local',
      filenames: []
    };
    expect(toOrgChange(change)).toEqual({
      fullName: 'MyClass',
      type: 'ApexClass',
      state: 'local'
    });
  });
});
