/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { registry, SourceComponent, VirtualDirectory, VirtualTreeContainer } from '@salesforce/source-deploy-retrieve';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '@salesforce/source-deploy-retrieve/lib/src/common';
import { JsToXml } from '@salesforce/source-deploy-retrieve/lib/src/convert/streams';
import { join } from 'path';
import { mockRegistryData } from '../mockRegistry';

// Constants for a matching content file type
const type = mockRegistryData.types.nondecomposed;

export const WORKING_DIR = join(process.cwd(), 'my-project');

export const DEFAULT_DIR = join(WORKING_DIR, 'force-app');
export const NON_DEFAULT_DIR = join(WORKING_DIR, 'my-app');

export const XML_NAME = `${type.name}.${type.suffix}${META_XML_SUFFIX}`;

export const COMPONENT_1_TYPE_DIR = join(DEFAULT_DIR, 'path', 'to', type.directoryName);
export const COMPONENT_2_TYPE_DIR = join(NON_DEFAULT_DIR, type.directoryName);
export const COMPONENT_1_XML_PATH = join(COMPONENT_1_TYPE_DIR, XML_NAME);
export const COMPONENT_2_XML_PATH = join(COMPONENT_2_TYPE_DIR, XML_NAME);

export const CHILD_1_NAME = 'Child_1';
export const CHILD_2_NAME = 'Child_2';
export const CHILD_3_NAME = 'Child_3';
export const UNCLAIMED_CHILD_NAME = 'Unclaimed_Child';

export const CHILD_1_XML = { id: CHILD_1_NAME, description: 'the first child' };
export const CHILD_2_XML = { id: CHILD_2_NAME, description: 'the second child' };
export const CHILD_3_XML = { id: CHILD_3_NAME, description: 'the third child' };
export const UNCLAIMED_CHILD_XML = { id: UNCLAIMED_CHILD_NAME, description: 'the unclaimed child' };

export const COMPONENT_1_XML = {
  [type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    [type.directoryName]: [CHILD_1_XML, CHILD_2_XML]
  }
};

export const COMPONENT_2_XML = {
  [type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    [type.directoryName]: CHILD_3_XML
  }
};

export const CLAIMED_XML_CONTENT = {
  [type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    [type.directoryName]: [CHILD_1_XML, CHILD_2_XML, CHILD_3_XML]
  }
};

export const UNCLAIMED_XML_CONTENT = {
  [type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    [type.directoryName]: UNCLAIMED_CHILD_XML
  }
};

export const FULL_XML_CONTENT = {
  [type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    [type.directoryName]: [CHILD_1_XML, CHILD_2_XML, CHILD_3_XML, UNCLAIMED_CHILD_XML]
  }
};

export const MATCHING_RULES_TYPE = registry.types.matchingrules;
// NOTE: directory name uses the string literal rather than getting from MATCHING_RULES_TYPE
// so it explictly shows that this matches the xml field
export const MATCHING_RULES_TYPE_DIRECTORY_NAME = 'matchingRules';
export const MATCHING_RULES_XML_NAME = 'Account.matchingRule-meta.xml';
export const MATCHING_RULES_COMPONENT_DIR = join(DEFAULT_DIR, MATCHING_RULES_TYPE_DIRECTORY_NAME);
export const MATCHING_RULES_COMPONENT_XML_PATH = join(
  MATCHING_RULES_COMPONENT_DIR,
  MATCHING_RULES_XML_NAME
);
export const MATCHING_RULES_COMPONENT_XML = {
  MatchingRules: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    matchingRules: {
      fullName: 'My_Account_Matching_Rule',
      booleanFilter: '1 AND 2',
      label: 'My Account Matching Rule',
      matchingRuleItems: [
        {
          blankValueBehavior: 'NullNotAllowed',
          fieldName: 'Name',
          matchingMethod: 'Exact'
        },
        {
          blankValueBehavior: 'NullNotAllowed',
          fieldName: 'BillingCity',
          matchingMethod: 'Exact'
        }
      ],
      ruleStatus: 'Active'
    }
  }
};

export const VIRTUAL_DIR: VirtualDirectory[] = [
  { dirPath: WORKING_DIR, children: [DEFAULT_DIR, NON_DEFAULT_DIR] },
  { dirPath: DEFAULT_DIR, children: [] },
  { dirPath: NON_DEFAULT_DIR, children: [] },
  {
    dirPath: COMPONENT_1_TYPE_DIR,
    children: [
      { name: XML_NAME, data: Buffer.from(new JsToXml(COMPONENT_1_XML).read().toString()) }
    ]
  },
  {
    dirPath: COMPONENT_2_TYPE_DIR,
    children: [
      { name: XML_NAME, data: Buffer.from(new JsToXml(COMPONENT_2_XML).read().toString()) }
    ]
  },
  {
    dirPath: MATCHING_RULES_COMPONENT_DIR,
    children: [
      {
        name: MATCHING_RULES_XML_NAME,
        data: Buffer.from(new JsToXml(MATCHING_RULES_COMPONENT_XML).read().toString())
      }
    ]
  }
];

export const TREE = new VirtualTreeContainer(VIRTUAL_DIR);

export const COMPONENT_1 = new SourceComponent(
  { name: type.name, type, xml: COMPONENT_1_XML_PATH },
  TREE
);

export const COMPONENT_2 = new SourceComponent(
  { name: type.name, type, xml: COMPONENT_2_XML_PATH },
  TREE
);

export const MATCHING_RULES_COMPONENT = new SourceComponent(
  {
    name: MATCHING_RULES_TYPE.name,
    type: MATCHING_RULES_TYPE,
    xml: MATCHING_RULES_COMPONENT_XML_PATH
  },
  TREE
);
