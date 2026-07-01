/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DescribeMetadataObject } from 'jsforce/lib/api/metadata/schema';
import { toMetadataTypeInfo } from '../../src/owned/metadataTypeInfoMapper';

describe('metadataTypeInfoMapper', () => {
  describe('toMetadataTypeInfo', () => {
    it('should map all fields from DescribeMetadataObject to MetadataTypeInfo', () => {
      const source: DescribeMetadataObject = {
        xmlName: 'ApexClass',
        directoryName: 'classes',
        inFolder: false,
        metaFile: true,
        suffix: 'cls',
        childXmlNames: ['ApexClassMember']
      };

      const result = toMetadataTypeInfo(source);

      expect(result).toEqual({
        xmlName: 'ApexClass',
        directoryName: 'classes',
        inFolder: false,
        metaFile: true,
        suffix: 'cls',
        childXmlNames: ['ApexClassMember']
      });
    });

    it('should handle optional fields (directoryName, suffix, childXmlNames)', () => {
      const source: DescribeMetadataObject = {
        xmlName: 'CustomObject',
        directoryName: 'objects',
        inFolder: false,
        metaFile: false,
        childXmlNames: []
      };

      const result = toMetadataTypeInfo(source);

      expect(result).toEqual({
        xmlName: 'CustomObject',
        directoryName: 'objects',
        inFolder: false,
        metaFile: false,
        childXmlNames: []
      });
    });

    it('should handle null/undefined suffix', () => {
      const source: DescribeMetadataObject = {
        xmlName: 'Settings',
        directoryName: 'settings',
        inFolder: false,
        metaFile: true,
        suffix: null,
        childXmlNames: []
      };

      const result = toMetadataTypeInfo(source);

      expect(result.xmlName).toBe('Settings');
      expect(result.suffix).toBeUndefined();
    });

    it('should map inFolder types correctly', () => {
      const source: DescribeMetadataObject = {
        xmlName: 'Report',
        directoryName: 'reports',
        inFolder: true,
        metaFile: true,
        suffix: 'report',
        childXmlNames: []
      };

      const result = toMetadataTypeInfo(source);

      expect(result).toEqual({
        xmlName: 'Report',
        directoryName: 'reports',
        inFolder: true,
        metaFile: true,
        suffix: 'report',
        childXmlNames: []
      });
    });

    it('should handle empty childXmlNames array', () => {
      const source: DescribeMetadataObject = {
        xmlName: 'StaticResource',
        directoryName: 'staticresources',
        inFolder: false,
        metaFile: true,
        suffix: 'resource',
        childXmlNames: []
      };

      const result = toMetadataTypeInfo(source);

      expect(result.childXmlNames).toEqual([]);
    });
  });
});
