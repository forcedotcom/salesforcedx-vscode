/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ValueNode, StringNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';
import * as fs from 'node:fs';
import * as pathModule from 'node:path';

type PathMatcher = {
  path: string[];
  check: (node: StringNode, context: Rule.RuleContext) => void;
};

const I18N_PATTERN = /^%([^%]+)%$/;

const extractI18nKey = (value: string): string | undefined => {
  const match = value.match(I18N_PATTERN);
  return match ? match[1] : undefined;
};

const loadNlsKeys = (packageJsonPath: string): Set<string> => {
  const dir = pathModule.dirname(packageJsonPath);
  const nlsPath = pathModule.join(dir, 'package.nls.json');

  try {
    const content = fs.readFileSync(nlsPath, 'utf8');
    const nls = JSON.parse(content) as Record<string, string>;
    return new Set(Object.keys(nls));
  } catch {
    return new Set();
  }
};

const findNodeAtPath = (node: ValueNode, pathSegments: string[]): ValueNode[] => {
  if (pathSegments.length === 0) {
    return [node];
  }

  const [key, ...rest] = pathSegments;

  if (node.type === 'Object') {
    const member = node.members.find(m => {
      const nameNode = m.name;
      return nameNode.type === 'String' && nameNode.value === key;
    });
    return member ? findNodeAtPath(member.value, rest) : [];
  }

  if (node.type === 'Array' && key === '*') {
    return node.elements.flatMap(el => findNodeAtPath(el.value, rest));
  }

  if (node.type === 'Array' && /^\d+$/.test(key)) {
    const index = parseInt(key, 10);
    const element = node.elements[index];
    return element ? findNodeAtPath(element.value, rest) : [];
  }

  return [];
};

const checkStringValue = (
  node: StringNode,
  context: Rule.RuleContext,
  nlsKeys: Set<string>,
  propertyPath: string
): void => {
  const value = node.value;
  const i18nKey = extractI18nKey(value);

  if (!i18nKey) {
    context.report({
      node: node as unknown as Rule.Node,
      messageId: 'hardcodedString',
      data: { path: propertyPath, value }
    });
    return;
  }

  if (!nlsKeys.has(i18nKey)) {
    context.report({
      node: node as unknown as Rule.Node,
      messageId: 'missingKey',
      data: { key: i18nKey }
    });
  }
};

const createPathMatchers = (nlsKeys: Set<string>): PathMatcher[] => [
  {
    path: ['contributes', 'commands', '*', 'title'],
    check: (node, context) => checkStringValue(node, context, nlsKeys, 'contributes.commands[*].title')
  },
  {
    path: ['contributes', 'configuration', 'title'],
    check: (node, context) => checkStringValue(node, context, nlsKeys, 'contributes.configuration.title')
  },
  {
    path: ['contributes', 'configuration', 'properties', '*', 'description'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.configuration.properties[*].description')
  },
  {
    path: ['contributes', 'configuration', 'properties', '*', 'markdownDescription'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.configuration.properties[*].markdownDescription')
  },
  {
    path: ['contributes', 'configuration', 'properties', '*', 'enumDescriptions', '*'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.configuration.properties[*].enumDescriptions[*]')
  },
  {
    path: ['contributes', 'debuggers', '*', 'label'],
    check: (node, context) => checkStringValue(node, context, nlsKeys, 'contributes.debuggers[*].label')
  },
  {
    path: ['contributes', 'debuggers', '*', 'configurationSnippets', '*', 'label'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.debuggers[*].configurationSnippets[*].label')
  },
  {
    path: ['contributes', 'debuggers', '*', 'configurationSnippets', '*', 'description'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.debuggers[*].configurationSnippets[*].description')
  },
  {
    path: ['contributes', 'debuggers', '*', 'configurationSnippets', '*', 'body', 'name'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.debuggers[*].configurationSnippets[*].body.name')
  },
  {
    path: ['contributes', 'debuggers', '*', 'configurationAttributes', 'launch', 'properties', '*', 'description'],
    check: (node, context) =>
      checkStringValue(
        node,
        context,
        nlsKeys,
        'contributes.debuggers[*].configurationAttributes.launch.properties[*].description'
      )
  },
  {
    path: ['contributes', 'views', '*', '*', 'name'],
    check: (node, context) => checkStringValue(node, context, nlsKeys, 'contributes.views[*][*].name')
  },
  {
    path: ['contributes', 'viewsContainers', 'activitybar', '*', 'title'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.viewsContainers.activitybar[*].title')
  },
  {
    path: ['contributes', 'walkthroughs', '*', 'title'],
    check: (node, context) => checkStringValue(node, context, nlsKeys, 'contributes.walkthroughs[*].title')
  },
  {
    path: ['contributes', 'walkthroughs', '*', 'description'],
    check: (node, context) => checkStringValue(node, context, nlsKeys, 'contributes.walkthroughs[*].description')
  },
  {
    path: ['contributes', 'walkthroughs', '*', 'steps', '*', 'title'],
    check: (node, context) => checkStringValue(node, context, nlsKeys, 'contributes.walkthroughs[*].steps[*].title')
  },
  {
    path: ['contributes', 'walkthroughs', '*', 'steps', '*', 'description'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.walkthroughs[*].steps[*].description')
  },
  {
    path: ['contributes', 'walkthroughs', '*', 'steps', '*', 'media', 'altText'],
    check: (node, context) =>
      checkStringValue(node, context, nlsKeys, 'contributes.walkthroughs[*].steps[*].media.altText')
  }
];

export const packageJsonI18nDescriptions: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce i18n placeholders (%key%) in package.json contributes sections'
    },
    schema: [],
    messages: {
      hardcodedString: 'Property "{{path}}" must use i18n placeholder format %key%, found: "{{value}}"',
      missingKey: 'i18n key "%{{key}}%" not found in package.nls.json'
    }
  },
  create: context => {
    const filename = context.filename ?? context.getFilename();
    if (!filename.match(/packages\/[^/]+\/package\.json$/)) {
      return {};
    }

    const nlsKeys = loadNlsKeys(filename);
    const matchers = createPathMatchers(nlsKeys);

    return {
      // @eslint/json provides JSON AST wrapped in Program node
      'Program:exit': (node: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ast = node?.body as ValueNode | undefined;
        if (ast?.type !== 'Object') {
          return;
        }

        for (const matcher of matchers) {
          const nodes = findNodeAtPath(ast, matcher.path);
          for (const foundNode of nodes) {
            if (foundNode.type === 'String') {
              matcher.check(foundNode, context);
            }
          }
        }
      }
    } as Rule.RuleListener;
  }
};
