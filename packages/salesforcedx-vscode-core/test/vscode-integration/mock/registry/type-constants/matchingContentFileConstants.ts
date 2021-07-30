/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceComponent, VirtualTreeContainer } from '@salesforce/source-deploy-retrieve';
import { META_XML_SUFFIX } from '@salesforce/source-deploy-retrieve/lib/src/common';
import { join } from 'path';
import { mockRegistryData } from '../mockRegistry';

// Constants for a matching content file type
const type = mockRegistryData.types.matchingcontentfile;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_NAMES = ['a', 'b'];
export const XML_NAMES = COMPONENT_NAMES.map(name => `${name}.${type.suffix}${META_XML_SUFFIX}`);
export const XML_PATHS = XML_NAMES.map(name => join(TYPE_DIRECTORY, name));
export const CONTENT_NAMES = COMPONENT_NAMES.map(name => `${name}.${type.suffix}`);
export const CONTENT_PATHS = CONTENT_NAMES.map(name => join(TYPE_DIRECTORY, name));

const TREE = new VirtualTreeContainer([
  {
    dirPath: TYPE_DIRECTORY,
    children: XML_NAMES.concat(CONTENT_NAMES)
  }
]);

export const COMPONENTS = COMPONENT_NAMES.map(
  (name, index) =>
    new SourceComponent(
      {
        name,
        type,
        xml: XML_PATHS[index],
        content: CONTENT_PATHS[index]
      },
      TREE
    )
);
export const COMPONENT = COMPONENTS[0];

export const CONTENT_COMPONENT = new SourceComponent({
  name: 'a',
  type,
  xml: CONTENT_PATHS[0]
});
