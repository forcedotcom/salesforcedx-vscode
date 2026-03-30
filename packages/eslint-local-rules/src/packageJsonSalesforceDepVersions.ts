/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';

import { findNodeAtPath } from './jsonAstUtils';

export const packageJsonSalesforceDepVersions: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require caret ranges (^) for all @salesforce/* dependencies'
    },
    schema: [],
    messages: {
      pinnedVersion:
        '"{{dep}}" version "{{version}}" must use a caret range (^), not a pinned version'
    }
  },
  create: context => {
    const filename = context.filename ?? context.getFilename();
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

        for (const section of ['dependencies', 'devDependencies']) {
          const found = findNodeAtPath(ast, [section]);
          const obj = found[0];
          if (obj?.type !== 'Object') {
            continue;
          }

          for (const member of obj.members) {
            const dep = member.name.type === 'String' ? member.name.value : undefined;
            const version = member.value.type === 'String' ? member.value.value : undefined;
            if (!dep?.startsWith('@salesforce/') || version === undefined) {
              continue;
            }
            if (/^[\d~]/.test(version)) {
              context.report({
                node: member.value as unknown as Rule.Node,
                messageId: 'pinnedVersion',
                data: { dep, version }
              });
            }
          }
        }
      }
    } as Rule.RuleListener;
  }
};
