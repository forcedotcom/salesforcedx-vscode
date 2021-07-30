/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { join } from 'path';
import { mockRegistryData } from '../mockRegistry';

const type = mockRegistryData.types.bundle;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
const COMPONENT_NAME = 'a';
export const CONTENT_PATH = join(TYPE_DIRECTORY, 'a');
export const XML_NAME = `${COMPONENT_NAME}.js-meta.xml`;
export const XML_PATH = join(CONTENT_PATH, XML_NAME);
export const SUBTYPE_XML_PATH = join(CONTENT_PATH, 'b.z-meta.xml');
export const SOURCE_PATHS = [
  join(CONTENT_PATH, 'a.js'),
  join(CONTENT_PATH, 'a.css'),
  join(CONTENT_PATH, 'a.html')
];
export const COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: 'a',
    type,
    xml: XML_PATH,
    content: CONTENT_PATH
  },
  [
    {
      dirPath: TYPE_DIRECTORY,
      children: [COMPONENT_NAME]
    },
    {
      dirPath: CONTENT_PATH,
      children: [XML_NAME, 'a.js', 'a.css', 'a.html']
    }
  ]
);
