/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import type { SourceSpec } from '../../../src/owned/deploy';
import type { OwnedMetadataMember } from '../../../src/owned/components';

describe('ComponentSetService members filter types', () => {
  it('SourceSpec projectDirectories accepts optional members', () => {
    const specWithMembers: SourceSpec = {
      kind: 'projectDirectories',
      members: [{ type: 'ApexClass', fullName: '*' }]
    };
    expect(specWithMembers.kind).toBe('projectDirectories');
    if (specWithMembers.kind === 'projectDirectories') {
      expect(specWithMembers.members).toBeDefined();
      expect(specWithMembers.members).toHaveLength(1);
    }
  });

  it('SourceSpec projectDirectories works without members', () => {
    const specWithoutMembers: SourceSpec = {
      kind: 'projectDirectories'
    };
    expect(specWithoutMembers.kind).toBe('projectDirectories');
    if (specWithoutMembers.kind === 'projectDirectories') {
      expect(specWithoutMembers.members).toBeUndefined();
    }
  });

  it('OwnedMetadataMember structure is compatible with SDR MetadataMember', () => {
    const member: OwnedMetadataMember = { type: 'ApexClass', fullName: 'MyClass' };
    // Verify it has the expected shape - SDR MetadataMember also has {type, fullName}
    expect(member.type).toBe('ApexClass');
    expect(member.fullName).toBe('MyClass');

    // Simulate the mapping that happens in buildComponentSet
    const mappedForSDR = { type: member.type, fullName: member.fullName };
    expect(mappedForSDR).toEqual({ type: 'ApexClass', fullName: 'MyClass' });
  });

  it('members array can be passed to ComponentSet constructor', () => {
    const members: readonly OwnedMetadataMember[] = [
      { type: 'ApexClass', fullName: '*' },
      { type: 'ApexTrigger', fullName: '*' }
    ];

    // The actual buildComponentSet maps these and passes to ComponentSet constructor
    const componentSet = new ComponentSet(members.map(m => ({ type: m.type, fullName: m.fullName })));
    expect(componentSet).toBeDefined();
    expect(componentSet.size).toBeGreaterThan(0);
  });
});
