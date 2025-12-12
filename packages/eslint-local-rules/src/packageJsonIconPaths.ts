/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ValueNode, ObjectNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';
import * as fs from 'node:fs';
import * as pathModule from 'node:path';

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

const checkIconObject = (
  node: ObjectNode,
  context: Rule.RuleContext,
  packageJsonPath: string,
  propertyPath: string
): void => {
  const lightMember = node.members.find(m => m.name.type === 'String' && m.name.value === 'light');
  const darkMember = node.members.find(m => m.name.type === 'String' && m.name.value === 'dark');

  const hasLight = lightMember !== undefined;
  const hasDark = darkMember !== undefined;

  if (hasLight && !hasDark) {
    context.report({
      node: node as unknown as Rule.Node,
      messageId: 'missingDark',
      data: { path: propertyPath }
    });
    return;
  }

  if (hasDark && !hasLight) {
    context.report({
      node: node as unknown as Rule.Node,
      messageId: 'missingLight',
      data: { path: propertyPath }
    });
    return;
  }

  if (!hasLight && !hasDark) {
    return;
  }

  const dir = pathModule.dirname(packageJsonPath);

  if (lightMember?.value.type === 'String') {
    const lightPath = lightMember.value.value;
    const fullLightPath = pathModule.join(dir, lightPath);
    if (!fs.existsSync(fullLightPath)) {
      context.report({
        node: lightMember.value as unknown as Rule.Node,
        messageId: 'iconNotFound',
        data: { path: propertyPath, iconPath: lightPath }
      });
    }
  }

  if (darkMember?.value.type === 'String') {
    const darkPath = darkMember.value.value;
    const fullDarkPath = pathModule.join(dir, darkPath);
    if (!fs.existsSync(fullDarkPath)) {
      context.report({
        node: darkMember.value as unknown as Rule.Node,
        messageId: 'iconNotFound',
        data: { path: propertyPath, iconPath: darkPath }
      });
    }
  }
};

export const packageJsonIconPaths: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate icon paths in package.json contributes sections'
    },
    schema: [],
    messages: {
      missingDark: 'Icon object at "{{path}}" has "light" but missing "dark" property',
      missingLight: 'Icon object at "{{path}}" has "dark" but missing "light" property',
      iconNotFound: 'Icon file not found: "{{iconPath}}" at "{{path}}"'
    }
  },
  create: context => {
    const filename = context.filename ?? context.getFilename();
    if (!filename.match(/packages\/[^/]+\/package\.json$/)) {
      return {};
    }

    return {
      'Program:exit': (node: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ast = node?.body as ValueNode | undefined;
        if (ast?.type !== 'Object') {
          return;
        }

        const iconPaths = [
          ['contributes', 'commands', '*', 'icon'],
          ['contributes', 'viewsContainers', 'activitybar', '*', 'icon']
        ];

        for (const path of iconPaths) {
          const nodes = findNodeAtPath(ast, path);
          for (const foundNode of nodes) {
            if (foundNode.type === 'Object') {
              const pathStr = path.join('.');
              checkIconObject(foundNode, context, filename, pathStr);
            }
          }
        }
      }
    } as Rule.RuleListener;
  }
};
