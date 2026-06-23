/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ComponentSetInfo, OwnedMetadataMember } from '../../../src/owned/components';
import { componentSetHas, componentFilenamesByNameAndType } from '../../../src/owned/componentSetInfoHelpers';

describe('componentSetInfoHelpers', () => {
  const mockInfo: ComponentSetInfo = {
    size: 2,
    sourceApiVersion: '60.0',
    projectDirectory: '/test',
    components: [
      { fullName: 'MyClass', type: 'ApexClass', contentPaths: ['/test/MyClass.cls', '/test/MyClass.cls-meta.xml'] },
      { fullName: 'MyTrigger', type: 'ApexTrigger', contentPaths: ['/test/MyTrigger.trigger'] }
    ],
    packageXml: '<Package/>'
  };

  describe('componentSetHas', () => {
    it('returns true when component is present', () => {
      const member: OwnedMetadataMember = { type: 'ApexClass', fullName: 'MyClass' };
      expect(componentSetHas(mockInfo, member)).toBe(true);
    });

    it('returns false when component is absent by fullName', () => {
      const member: OwnedMetadataMember = { type: 'ApexClass', fullName: 'NotFound' };
      expect(componentSetHas(mockInfo, member)).toBe(false);
    });

    it('returns false when component is absent by type', () => {
      const member: OwnedMetadataMember = { type: 'CustomObject', fullName: 'MyClass' };
      expect(componentSetHas(mockInfo, member)).toBe(false);
    });
  });

  describe('componentFilenamesByNameAndType', () => {
    it('returns file paths when component is present', () => {
      const member: OwnedMetadataMember = { type: 'ApexClass', fullName: 'MyClass' };
      const paths = componentFilenamesByNameAndType(mockInfo, member);
      expect(paths).toEqual(['/test/MyClass.cls', '/test/MyClass.cls-meta.xml']);
    });

    it('returns empty array when component is absent', () => {
      const member: OwnedMetadataMember = { type: 'ApexClass', fullName: 'NotFound' };
      const paths = componentFilenamesByNameAndType(mockInfo, member);
      expect(paths).toEqual([]);
    });

    it('returns empty array when component has no contentPaths', () => {
      const infoWithNoPaths: ComponentSetInfo = {
        ...mockInfo,
        components: [{ fullName: 'MyClass', type: 'ApexClass', contentPaths: [] }]
      };
      const member: OwnedMetadataMember = { type: 'ApexClass', fullName: 'MyClass' };
      const paths = componentFilenamesByNameAndType(infoWithNoPaths, member);
      expect(paths).toEqual([]);
    });
  });
});
