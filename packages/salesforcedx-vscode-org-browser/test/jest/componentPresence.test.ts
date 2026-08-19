/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';
import { isMemberPresentInProject } from '../../src/commands/componentPresence';

const member: MetadataMember = { type: 'CustomObject', fullName: 'Broker__c' };

const componentSet = (has: boolean, filenames: string[]): ComponentSet =>
  ({
    has: jest.fn(() => has),
    getComponentFilenamesByNameAndType: jest.fn(() => filenames)
  }) as unknown as ComponentSet;

describe('isMemberPresentInProject', () => {
  it('uses ComponentSet membership when available', () => {
    expect(isMemberPresentInProject(componentSet(true, []), member)).toBe(true);
  });

  it('detects decomposed metadata through the filename index', () => {
    expect(
      isMemberPresentInProject(
        componentSet(false, ['force-app/main/default/objects/Broker__c/fields/Price__c.field-meta.xml']),
        member
      )
    ).toBe(true);
  });

  it('returns false when neither index contains the member', () => {
    expect(isMemberPresentInProject(componentSet(false, []), member)).toBe(false);
  });
});
