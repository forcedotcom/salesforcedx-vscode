/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceComponent, VirtualDirectory } from '@salesforce/source-deploy-retrieve';
import { XML_NS_URL } from '@salesforce/source-deploy-retrieve/lib/src/common';
import { baseName } from '@salesforce/source-deploy-retrieve/lib/src/utils';
import { join } from 'path';
import { mockRegistryData } from '../mockRegistry';

// Constants for a decomposed type
const type = mockRegistryData.types.decomposed;

export const DECOMPOSEDS_PATH = join('path', 'to', 'decomposeds');
export const DECOMPOSED_PATH = join(DECOMPOSEDS_PATH, 'a');
export const DECOMPOSED_XML_NAME = 'a.decomposed-meta.xml';
export const DECOMPOSED_XML_PATH = join(DECOMPOSED_PATH, DECOMPOSED_XML_NAME);
export const DECOMPOSED_CHILD_XML_NAME_1 = 'z.y-meta.xml';
export const DECOMPOSED_CHILD_XML_PATH_1 = join(DECOMPOSED_PATH, DECOMPOSED_CHILD_XML_NAME_1);
export const DECOMPOSED_CHILD_DIR = 'xs';
export const DECOMPOSED_CHILD_DIR_PATH = join(DECOMPOSED_PATH, DECOMPOSED_CHILD_DIR);
export const DECOMPOSED_CHILD_XML_NAME_2 = 'w.x-meta.xml';
export const DECOMPOSED_CHILD_XML_PATH_2 = join(
  DECOMPOSED_CHILD_DIR_PATH,
  DECOMPOSED_CHILD_XML_NAME_2
);
export const DECOMPOSED_VIRTUAL_FS: VirtualDirectory[] = [
  {
    dirPath: DECOMPOSED_PATH,
    children: [
      {
        name: DECOMPOSED_XML_NAME,
        data: Buffer.from(`<Decomposed xmlns="${XML_NS_URL}"><fullName>a</fullName></Decomposed>`)
      },
      { name: DECOMPOSED_CHILD_XML_NAME_1, data: Buffer.from('<Y><test>child1</test></Y>') },
      DECOMPOSED_CHILD_DIR
    ]
  },
  {
    dirPath: DECOMPOSED_CHILD_DIR_PATH,
    children: [
      { name: DECOMPOSED_CHILD_XML_NAME_2, data: Buffer.from('<X><test>child2</test></X>') }
    ]
  }
];
export const DECOMPOSED_COMPONENT = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_XML_PATH),
    type,
    xml: DECOMPOSED_XML_PATH,
    content: DECOMPOSED_PATH
  },
  DECOMPOSED_VIRTUAL_FS
);
export const DECOMPOSED_CHILD_COMPONENT_1 = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_CHILD_XML_NAME_1),
    type: type.children.types.y,
    xml: DECOMPOSED_CHILD_XML_PATH_1,
    parent: DECOMPOSED_COMPONENT
  },
  DECOMPOSED_VIRTUAL_FS
);
export const DECOMPOSED_CHILD_COMPONENT_2 = SourceComponent.createVirtualComponent(
  {
    name: baseName(DECOMPOSED_CHILD_XML_NAME_2),
    type: type.children.types.x,
    xml: DECOMPOSED_CHILD_XML_PATH_2,
    parent: DECOMPOSED_COMPONENT
  },
  DECOMPOSED_VIRTUAL_FS
);
