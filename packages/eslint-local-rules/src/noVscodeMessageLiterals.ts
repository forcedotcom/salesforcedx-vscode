/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

/** Check if an expression is a call to nls.localize() */
const isNlsLocalizeCall = (expr: TSESTree.Expression): boolean =>
  expr.type === AST_NODE_TYPES.CallExpression &&
  expr.callee.type === AST_NODE_TYPES.MemberExpression &&
  expr.callee.object.type === AST_NODE_TYPES.Identifier &&
  expr.callee.object.name === 'nls' &&
  expr.callee.property.type === AST_NODE_TYPES.Identifier &&
  expr.callee.property.name === 'localize';

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
      // Type guard: Check if this is vscode.window.show*Message
      if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;
      if (node.callee.object.type !== AST_NODE_TYPES.MemberExpression) return;

      const vscodeObj = node.callee.object;
      if (vscodeObj.object.type !== AST_NODE_TYPES.Identifier) return;
      if (vscodeObj.object.name !== 'vscode') return;
      if (vscodeObj.property.type !== AST_NODE_TYPES.Identifier) return;
      if (vscodeObj.property.name !== 'window') return;
      if (node.callee.property.type !== AST_NODE_TYPES.Identifier) return;

      const methodName = node.callee.property.name;
      if (!/^show(Information|Warning|Error)Message$/.test(methodName)) return;

      // Check first argument
      const firstArg = node.arguments[0];
      if (!firstArg) return; // No arguments, let TypeScript handle this error

      // Disallow string literals
      if (firstArg.type === AST_NODE_TYPES.Literal && typeof firstArg.value === 'string') {
        context.report({
          node: firstArg,
          messageId: 'noLiteral',
          data: { method: methodName }
        });
        return;
      }

      // Disallow template literals UNLESS they contain nls.localize() calls
      if (firstArg.type === AST_NODE_TYPES.TemplateLiteral) {
        const hasNlsLocalize = firstArg.expressions.some(isNlsLocalizeCall);
        if (!hasNlsLocalize) {
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
