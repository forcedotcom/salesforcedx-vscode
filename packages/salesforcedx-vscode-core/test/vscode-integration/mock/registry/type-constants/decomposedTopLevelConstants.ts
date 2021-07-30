/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { baseName } from '@salesforce/source-deploy-retrieve/lib/src/utils';
import { join } from 'path';
import { mockRegistryData } from '../mockRegistry';

export const DECOMPOSED_TOP_LEVEL_DIR = join('path', 'to', 'decomposedTopLevels');
export const DECOMPOSED_TOP_LEVEL_COMPONENT_PATH = join(DECOMPOSED_TOP_LEVEL_DIR, 'a');
export const DECOMPOSED_TOP_LEVEL_XML_NAMES = ['a.dtl-meta.xml'];
export const DECOMPOSED_TOP_LEVEL_XML_PATH = join(
  DECOMPOSED_TOP_LEVEL_COMPONENT_PATH,
  DECOMPOSED_TOP_LEVEL_XML_NAMES[0]
);
export const DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES = ['z.g-meta.xml', 'y.g-meta.xml'];
export const DECOMPOSED_TOP_LEVEL_CHILD_XML_PATHS = DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES.map(n =>
  join(DECOMPOSED_TOP_LEVEL_COMPONENT_PATH, n)
);

export const DECOMPOSED_VIRTUAL_FS = [
  {
    dirPath: DECOMPOSED_TOP_LEVEL_COMPONENT_PATH,
    children: [
      DECOMPOSED_TOP_LEVEL_XML_NAMES[0],
      DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES[0],
      DECOMPOSED_TOP_LEVEL_CHILD_XML_NAMES[1]
    ]
  }
];

export const DECOMPOSED_TOP_LEVEL_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_TOP_LEVEL_XML_PATH),
    type: mockRegistryData.types.decomposedtoplevel,
    xml: DECOMPOSED_TOP_LEVEL_XML_PATH,
    content: DECOMPOSED_TOP_LEVEL_COMPONENT_PATH
  },
  DECOMPOSED_VIRTUAL_FS
);
