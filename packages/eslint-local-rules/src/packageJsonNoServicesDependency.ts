/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';

import { findNodeAtPath } from './jsonAstUtils';

const SERVICES_PACKAGE = 'salesforcedx-vscode-services';

export const packageJsonNoServicesDependency: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: `Disallow ${SERVICES_PACKAGE} as a runtime dependency`
    },
    schema: [],
    messages: {
      servicesDependency: `${SERVICES_PACKAGE} must be an extensionDependency and, when needed for compilation, listed under devDependencies; remove it from dependencies`
    }
  },
  create: context => {
    if (!context.filename.match(/packages[\\/][^\\/]+[\\/]package\.json$/)) {
      return {};
    }

    return {
      'Document:exit': (node: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ast = node?.body as ValueNode | undefined;
        if (ast?.type !== 'Object') {
          return;
        }

        const dependencies = findNodeAtPath(ast, ['dependencies'])[0];
        if (dependencies?.type !== 'Object') {
          return;
        }

        const servicesDependency = dependencies.members.find(
          member => member.name.type === 'String' && member.name.value === SERVICES_PACKAGE
        );
        if (servicesDependency) {
          context.report({
            node: servicesDependency as unknown as Rule.Node,
            messageId: 'servicesDependency'
          });
        }
      }
    } as Rule.RuleListener;
  }
};
