/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';
import data from '../src/build-time-resources/lwc-standard.json' with { type: 'json' };

type Tag = (typeof data)[keyof typeof data];

const getComponentLibraryLink = (name: string) =>
  `[View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/${name})`;

const getHover = (tag: Tag, name: string) => {
  let retVal = `${tag.description}\n${getComponentLibraryLink(name)}\n### Attributes\n`;

  for (const info of tag.attributes) {
    retVal += getAttributeMarkdown(info);
    retVal += '\n';
  }

  return retVal;
};

const getAttributeMarkdown = (attribute: Tag['attributes'][number]) => {
  if (!attribute.name) return '';
  const name = `* **${attribute.name}**`;
  if (!attribute.type) return name;
  const withType = `${name}: *${attribute.type}*`;
  return attribute.description ? `${withType} ${attribute.description}` : withType;
};

// create tags from old file
const tags = Object.entries(data).map(([key, tag]) => ({
  name: key,
  description: getHover(tag, key),
  attributes: tag.attributes.map(({ name, description }) => ({
    name,
    description
  }))
}));

// make globalAttribute changes here, not in transformed-lwc-standard.json as they'll be overwritten
const globalAttributes = [
  {
    name: 'for:each',
    description: 'Renders the element or template block multiple times based on the expression value.',
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  },
  {
    name: 'for:item',
    description: 'Bind the current iteration item to an identifier.',
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  },
  {
    name: 'for:index',
    description: 'Bind the current iteration index to an identifier.',
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  },
  {
    name: 'if:true',
    description:
      'Renders the element or template if the expression value is truthy. This directive is deprecated and no longer recommended. It may be removed in the future. Use lwc:if, lwc:elseif, and lwc:else instead.',
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  },
  {
    name: 'if:false',
    description:
      'Renders the element or template if the expression value is falsy. This directive is deprecated and no longer recommended. It may be removed in the future. Use lwc:if, lwc:elseif, and lwc:else instead.',
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  },
  {
    name: 'lwc:if',
    description: 'Renders the element or template if the expression value is truthy.',
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  },
  {
    name: 'lwc:elseif',
    description: 'Renders the element or template if the expression value is truthy.',
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  },
  {
    name: 'lwc:else',
    description:
      'Renders the element or template if none of the expressions values of the preceding lwc:if or lwc:elseif are truthy.',
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  },
  {
    name: 'iterator:it',
    description: {
      kind: 'markdown',
      value:
        'Bind the current iteration item to an identifier. Contains properties (`value`, `index`, `first`, `last`) that let you apply special behaviors to certain items.'
    },
    references: [
      {
        name: 'Salesforce',
        url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives'
      }
    ]
  }
];

const newJson = {
  version: '1.1',
  tags,
  globalAttributes
};

const transformedLWC = new URL('../src/resources/transformed-lwc-standard.json', import.meta.url);
fs.writeFileSync(transformedLWC, JSON.stringify(newJson, null, 2));

console.log('done building transformed-lwc-standard.json');
