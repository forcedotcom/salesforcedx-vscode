/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ObjectNode, ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';
import * as fs from 'node:fs';
import * as pathModule from 'node:path';

import { findNodeAtPath } from './jsonAstUtils';

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
      // @eslint/json provides JSON AST with Document as root node
      'Document:exit': (node: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ast = node?.body as ValueNode | undefined;
        if (ast?.type !== 'Object') {
          return;
        }

        const iconPaths = [
          { path: ['contributes', 'commands', '*', 'icon'], pathStr: 'contributes.commands[*].icon' },
          {
            path: ['contributes', 'viewsContainers', 'activitybar', '*', 'icon'],
            pathStr: 'contributes.viewsContainers.activitybar[*].icon'
          }
        ];

        for (const { path, pathStr } of iconPaths) {
          const nodes = findNodeAtPath(ast, path);
          for (const foundNode of nodes) {
            if (foundNode.type === 'Object') {
              checkIconObject(foundNode, context, filename, pathStr);
            }
          }
        }
      }
    } as Rule.RuleListener;
  }
};
