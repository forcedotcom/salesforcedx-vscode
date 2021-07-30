/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { basename, dirname, join } from 'path';
import { mockRegistryData } from '../mockRegistry';

// Mixed content with directory as content
const type = mockRegistryData.types.mixedcontentdirectory;

export const MIXED_CONTENT_DIRECTORY_DIR = join('path', 'to', 'mixedcontentdirectories');
export const MIXED_CONTENT_DIRECTORY_CONTENT_PATH = join(MIXED_CONTENT_DIRECTORY_DIR, 'a');
export const MIXED_CONTENT_DIRECTORY_XML_NAMES = ['a.mixedcontentdirectory-meta.xml'];
export const MIXED_CONTENT_DIRECTORY_XML_PATHS = MIXED_CONTENT_DIRECTORY_XML_NAMES.map(n =>
  join(MIXED_CONTENT_DIRECTORY_DIR, n)
);
export const MIXED_CONTENT_DIRECTORY_SOURCE_PATHS = [
  join(MIXED_CONTENT_DIRECTORY_CONTENT_PATH, 'test.xyz'),
  join(MIXED_CONTENT_DIRECTORY_CONTENT_PATH, 'b', 'test.g'),
  join(MIXED_CONTENT_DIRECTORY_CONTENT_PATH, 'b', 'test2.w')
];
export const MIXED_CONTENT_DIRECTORY_COMPONENT: SourceComponent = new SourceComponent({
  name: 'a',
  type,
  xml: MIXED_CONTENT_DIRECTORY_XML_PATHS[0],
  content: MIXED_CONTENT_DIRECTORY_CONTENT_PATH
});
export const MIXED_CONTENT_DIRECTORY_VIRTUAL_FS = [
  {
    dirPath: MIXED_CONTENT_DIRECTORY_DIR,
    children: [
      MIXED_CONTENT_DIRECTORY_XML_NAMES[0],
      basename(MIXED_CONTENT_DIRECTORY_CONTENT_PATH)
    ]
  },
  {
    dirPath: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
    children: [
      basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[0]),
      basename(dirname(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]))
    ]
  },
  {
    dirPath: dirname(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]),
    children: [
      basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]),
      basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[2])
    ]
  }
];
export const MIXED_CONTENT_DIRECTORY_VIRTUAL_FS_NO_XML = [
  {
    dirPath: MIXED_CONTENT_DIRECTORY_DIR,
    children: [basename(MIXED_CONTENT_DIRECTORY_CONTENT_PATH)]
  },
  {
    dirPath: MIXED_CONTENT_DIRECTORY_CONTENT_PATH,
    children: [
      basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[0]),
      basename(dirname(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]))
    ]
  },
  {
    dirPath: dirname(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]),
    children: [
      basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[1]),
      basename(MIXED_CONTENT_DIRECTORY_SOURCE_PATHS[2])
    ]
  }
];
