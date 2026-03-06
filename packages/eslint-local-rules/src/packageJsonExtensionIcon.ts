/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';
import * as fs from 'node:fs';
import * as pathModule from 'node:path';

import { findNodeAtPath } from './jsonAstUtils';

/** Published VS Code extensions: engines.vscode + name starts with salesforcedx-vscode */
const isPublishedExtension = (ast: ValueNode): boolean => {
  const engines = findNodeAtPath(ast, ['engines']);
  const eng = engines[0];
  if (eng?.type !== 'Object') return false;
  const vscode = eng.members.find(m => m.name.type === 'String' && m.name.value === 'vscode');
  if (vscode?.value.type !== 'String' || !vscode.value.value) return false;
  const nameNode = findNodeAtPath(ast, ['name'])[0];
  const name = nameNode?.type === 'String' ? nameNode.value : '';
  return typeof name === 'string' && name.startsWith('salesforcedx-vscode');
};

const getIconNode = (ast: ValueNode): ValueNode | undefined => {
  const iconNodes = findNodeAtPath(ast, ['icon']);
  return iconNodes[0];
};

export const packageJsonExtensionIcon: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Published VS Code extensions (salesforcedx-vscode*) must have an icon; icon paths must exist'
    },
    schema: [],
    messages: {
      extensionMissingIcon: 'Published VS Code extension (salesforcedx-vscode*) must have top-level "icon" field',
      iconNotFound: 'Icon file not found: "{{iconPath}}"'
    }
  },
  create: context => {
    const filename = context.filename ?? context.getFilename();
    if (!filename.match(/packages\/[^/]+\/package\.json$/)) {
      return {};
    }

    return {
      'Document:exit': (node: { body?: ValueNode }) => {
        const ast = node?.body;
        if (ast?.type !== 'Object') return;

        const dir = pathModule.dirname(filename);
        const isExtension = isPublishedExtension(ast);
        const iconNode = getIconNode(ast);

        if (isExtension && !iconNode) {
          context.report({
            node: ast as unknown as Rule.Node,
            messageId: 'extensionMissingIcon'
          });
          return;
        }

        if (iconNode?.type === 'String') {
          const iconPath = iconNode.value;
          const fullPath = pathModule.join(dir, iconPath);
          if (!fs.existsSync(fullPath)) {
            context.report({
              node: iconNode as unknown as Rule.Node,
              messageId: 'iconNotFound',
              data: { iconPath }
            });
          }
        }
      }
    } as Rule.RuleListener;
  }
};
