/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ObjectNode, ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';

import { findNodeAtPath } from './jsonAstUtils';

const PREINSTALL_VALUE = 'node ../../scripts/require-root-install.js';

export const packageJsonRequireRootInstall: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Unscoped packages must have "private": true and a preinstall guard to prevent dependency confusion attacks'
    },
    schema: [],
    messages: {
      missingPrivate: 'Unscoped package must have "private": true to prevent accidental npm publish.',
      missingPreinstall: `Unscoped package must have scripts.preinstall = "${PREINSTALL_VALUE}" to block direct npm install inside the package directory.`
    }
  },
  create: context => {
    const filename = context.filename;
    if (!filename.match(/packages\/[^/]+\/package\.json$/)) {
      return {};
    }

    return {
      'Document:exit': (node: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ast = node?.body as ValueNode | undefined;
        if (ast?.type !== 'Object') {
          return;
        }

        // Skip scoped packages — npm org membership required to publish, no confusion risk
        const nameNodes = findNodeAtPath(ast, ['name']);
        if (nameNodes.length === 0 || nameNodes[0].type !== 'String') {
          return;
        }
        const packageName = (nameNodes[0] as any).value as string;
        if (packageName.startsWith('@')) {
          return;
        }

        const root = ast as ObjectNode;

        // Check "private": true
        const privateNodes = findNodeAtPath(ast, ['private']);
        const hasPrivate =
          privateNodes.length > 0 && privateNodes[0].type === 'Boolean' && (privateNodes[0] as any).value === true;

        if (!hasPrivate) {
          // Find insert position: after "name" member if present, otherwise start of object
          const nameMember = root.members.find(m => m.name.type === 'String' && (m.name as any).value === 'name');
          if (nameMember) {
            context.report({
              node: nameMember as unknown as Rule.Node,
              messageId: 'missingPrivate',
              fix: fixer => fixer.insertTextAfter(nameMember as unknown as Rule.Node, ',\n  "private": true')
            });
          } else {
            context.report({
              node: root as unknown as Rule.Node,
              messageId: 'missingPrivate'
            });
          }
        }

        // Check scripts.preinstall
        const preinstallNodes = findNodeAtPath(ast, ['scripts', 'preinstall']);
        const hasPreinstall =
          preinstallNodes.length > 0 &&
          preinstallNodes[0].type === 'String' &&
          (preinstallNodes[0] as any).value === PREINSTALL_VALUE;

        if (!hasPreinstall) {
          const scriptsMember = root.members.find(m => m.name.type === 'String' && (m.name as any).value === 'scripts');

          if (scriptsMember?.value.type === 'Object') {
            const scriptsObj = scriptsMember.value as ObjectNode;
            if (scriptsObj.members.length > 0) {
              // Insert as first entry in scripts
              const firstMember = scriptsObj.members[0];
              context.report({
                node: firstMember as unknown as Rule.Node,
                messageId: 'missingPreinstall',
                fix: fixer =>
                  fixer.insertTextBefore(
                    firstMember as unknown as Rule.Node,
                    `"preinstall": "${PREINSTALL_VALUE}",\n    `
                  )
              });
            } else {
              context.report({
                node: scriptsMember as unknown as Rule.Node,
                messageId: 'missingPreinstall'
              });
            }
          } else {
            // No scripts section at all — report on the root
            context.report({
              node: root as unknown as Rule.Node,
              messageId: 'missingPreinstall'
            });
          }
        }
      }
    } as Rule.RuleListener;
  }
};
