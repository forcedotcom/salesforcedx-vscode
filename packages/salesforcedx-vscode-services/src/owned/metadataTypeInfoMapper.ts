/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MetadataTypeInfo } from './metadata';
import type { DescribeMetadataObject } from 'jsforce/lib/api/metadata/schema';

/**
 * Maps a jsforce DescribeMetadataObject to owned MetadataTypeInfo format.
 * Filters out null/undefined optional fields (suffix).
 *
 * @param obj - DescribeMetadataObject from jsforce metadata.describe()
 */
export const toMetadataTypeInfo = (obj: DescribeMetadataObject): MetadataTypeInfo => ({
  xmlName: obj.xmlName,
  directoryName: obj.directoryName,
  inFolder: obj.inFolder,
  metaFile: obj.metaFile,
  suffix: obj.suffix ?? undefined,
  childXmlNames: obj.childXmlNames
});
