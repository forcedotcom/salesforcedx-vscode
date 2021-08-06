/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { VirtualTreeContainer } from '@salesforce/source-deploy-retrieve';
import { VirtualFile } from '@salesforce/source-deploy-retrieve/lib/src/resolve/types';
import { join } from 'path';
import { mockRegistry, mockRegistryData } from '.';

const { decomposedtoplevel, mixedcontentsinglefile, mixedcontentinfolder } = mockRegistryData.types;

export const BASIC: VirtualFile = {
  name: 'basic.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>a</members>
        <name>${decomposedtoplevel.name}</name>
    </types>
    <types>
        <members>b</members>
        <members>c</members>
        <name>${mixedcontentsinglefile.name}</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`)
};

export const ONE_OF_EACH: VirtualFile = {
  name: 'one-of-each.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>a</members>
        <name>${decomposedtoplevel.name}</name>
    </types>
    <types>
        <members>b</members>
        <name>${mixedcontentsinglefile.name}</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`)
};

export const ONE_FOLDER_MEMBER: VirtualFile = {
  name: 'one-folder-member.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Test_Folder</members>
        <name>${mixedcontentinfolder.name}</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`)
};

export const ONE_WILDCARD: VirtualFile = {
  name: 'one-wildcard.xml',
  data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>*</members>
        <name>${mixedcontentsinglefile.name}</name>
    </types>
    <version>${mockRegistry.apiVersion}</version>
</Package>\n`)
};

export const TREE = new VirtualTreeContainer([
  {
    dirPath: '.',
    children: [
      'decomposedTopLevels',
      'mixedSingleFiles',
      BASIC,
      ONE_OF_EACH,
      ONE_WILDCARD,
      ONE_FOLDER_MEMBER
    ]
  },
  {
    dirPath: 'decomposedTopLevels',
    children: ['a']
  },
  {
    dirPath: join('decomposedTopLevels', 'a'),
    children: ['a.dtl-meta.xml', 'child1.g-meta.xml', 'child2.g-meta.xml']
  },
  {
    dirPath: 'mixedSingleFiles',
    children: ['b.foo', 'b.mixedSingleFile-meta.xml', 'c.bar', 'c.mixedSingleFile-meta.xml']
  }
]);
