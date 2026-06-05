/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

import { findObjectProperty, isStringLiteralOrTemplateWithoutNls, isVscodeWindowMethodCall } from './astUtils';

export const noVscodeQuickpickDescriptionLiterals = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow string literals in showQuickPick item descriptions - use nls.localize() instead'
    },
    schema: [],
    messages: {
      noLiteral:
        "showQuickPick item description must use nls.localize('message_key'), not a string literal. Add the message to i18n.ts and use nls.localize() to reference it."
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (!isVscodeWindowMethodCall(node, 'showQuickPick')) return;

      const itemsArg = node.arguments[0];
      if (itemsArg?.type !== AST_NODE_TYPES.ArrayExpression) return;

      for (const element of itemsArg.elements) {
        if (element?.type !== AST_NODE_TYPES.ObjectExpression) continue;
        const descProp = findObjectProperty(element, 'description');
        if (!descProp?.value) continue;

        const value = descProp.value;
        if (value.type === AST_NODE_TYPES.AssignmentPattern) continue;

        const expr = value as TSESTree.Expression;
        if (isStringLiteralOrTemplateWithoutNls(expr)) {
          context.report({ node: value, messageId: 'noLiteral' });
        }
      }
    }
  })
});
