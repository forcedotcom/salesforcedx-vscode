/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { META_XML_SUFFIX } from '@salesforce/source-deploy-retrieve/lib/src/common';
import { basename, join } from 'path';
import { mockRegistryData } from '../mockRegistry';

const type = mockRegistryData.types.xmlinfolder;
const folderType = mockRegistryData.types.xmlinfolderfolder;

export const TYPE_DIRECTORY = join('path', 'to', type.directoryName);
export const COMPONENT_FOLDER_NAME = 'A_Folder';
export const COMPONENT_FOLDER_PATH = join(TYPE_DIRECTORY, COMPONENT_FOLDER_NAME);
export const COMPONENT_NAMES = ['a', 'b', 'c'];
export const XML_PATHS = COMPONENT_NAMES.map(name =>
  join(COMPONENT_FOLDER_PATH, `${name}.${type.suffix}${META_XML_SUFFIX}`)
);
export const XML_NAMES = XML_PATHS.map(path => basename(path));
export const XML_PATHS_MD_FORMAT = COMPONENT_NAMES.map(name =>
  join(COMPONENT_FOLDER_PATH, `${name}.${type.suffix}`)
);
export const COMPONENTS: SourceComponent[] = COMPONENT_NAMES.map(
  (name, index) =>
    new SourceComponent({
      name: `${COMPONENT_FOLDER_NAME}/${name}`,
      type,
      xml: XML_PATHS[index]
    })
);

export const FOLDER_XML_PATH = join(
  TYPE_DIRECTORY,
  `${COMPONENT_FOLDER_NAME}.${folderType.suffix}${META_XML_SUFFIX}`
);
export const FOLDER_XML_NAME = basename(FOLDER_XML_PATH);
export const FOLDER_COMPONENT = new SourceComponent({
  name: COMPONENT_FOLDER_NAME,
  type: folderType,
  xml: FOLDER_XML_PATH
});

export const COMPONENTS_MD_FORMAT: SourceComponent[] = COMPONENT_NAMES.map(
  (name, index) =>
    new SourceComponent({
      name: `${COMPONENT_FOLDER_NAME}/${name}`,
      type,
      xml: XML_PATHS_MD_FORMAT[index]
    })
);
export const FOLDER_COMPONENT_MD_FORMAT = new SourceComponent({
  name: COMPONENT_FOLDER_NAME,
  type: folderType,
  xml: join(TYPE_DIRECTORY, `${COMPONENT_FOLDER_NAME}${META_XML_SUFFIX}`)
});
