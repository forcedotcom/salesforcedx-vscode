/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

import {
  findVarInitInScope,
  isNlsLocalizeCall,
  isStringLiteralOrTemplateWithoutNls,
  isVscodeWindowMethodCall
} from './astUtils';

export const noVscodeMessageLiterals = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow string literals in vscode.window.show*Message calls - use nls.localize() or variables instead'
    },
    schema: [],
    messages: {
      noLiteral:
        "vscode.window.{{method}} must use nls.localize('message_key') or a variable, not a string literal. Add the message to i18n.ts and use nls.localize() to reference it."
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (!isVscodeWindowMethodCall(node, /^show(Information|Warning|Error)Message$/)) return;
      if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;
      if (node.callee.property.type !== AST_NODE_TYPES.Identifier) return;

      const methodName = node.callee.property.name;

      const firstArg = node.arguments[0];
      if (!firstArg) return;

      if (firstArg.type === AST_NODE_TYPES.Literal && typeof firstArg.value === 'string') {
        context.report({
          node: firstArg,
          messageId: 'noLiteral',
          data: { method: methodName }
        });
        return;
      }

      if (firstArg.type === AST_NODE_TYPES.TemplateLiteral) {
        if (!firstArg.expressions.some(isNlsLocalizeCall)) {
          context.report({
            node: firstArg,
            messageId: 'noLiteral',
            data: { method: methodName }
          });
        }
        return;
      }

      if (firstArg.type === AST_NODE_TYPES.Identifier) {
        const init = findVarInitInScope(context, node, firstArg.name);
        if (init && isStringLiteralOrTemplateWithoutNls(init)) {
          context.report({
            node: firstArg,
            messageId: 'noLiteral',
            data: { method: methodName }
          });
        }
      }
    }
  })
});
