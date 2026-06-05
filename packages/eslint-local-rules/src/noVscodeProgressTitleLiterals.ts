/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

import {
  findObjectProperty,
  findVarInitInScope,
  isStringLiteralOrTemplateWithoutNls,
  isVscodeWindowMethodCall
} from './astUtils';

/** Check if this is a promptService.withProgress(title) call (title as first arg, not in options object) */
const isPromptServiceWithProgressCall = (node: TSESTree.CallExpression): boolean =>
  node.callee.type === AST_NODE_TYPES.MemberExpression &&
  node.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.property.name === 'withProgress' &&
  !isVscodeWindowMethodCall(node, 'withProgress') &&
  node.arguments[0]?.type !== AST_NODE_TYPES.ObjectExpression;

export const noVscodeProgressTitleLiterals = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow string literals in withProgress title - use nls.localize() or variables instead'
    },
    schema: [],
    messages: {
      noLiteral:
        "withProgress title must use nls.localize('message_key') or a variable, not a string literal. Add the message to i18n.ts and use nls.localize() to reference it."
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (isVscodeWindowMethodCall(node, 'withProgress')) {
        const optionsArg = node.arguments[0];
        if (optionsArg?.type !== AST_NODE_TYPES.ObjectExpression) return;

        const titleProp = findObjectProperty(optionsArg, 'title');
        if (!titleProp?.value) return;

        const value = titleProp.value;
        if (value.type === AST_NODE_TYPES.AssignmentPattern) return;

        if (isStringLiteralOrTemplateWithoutNls(value as TSESTree.Expression)) {
          context.report({ node: value, messageId: 'noLiteral' });
          return;
        }

        if (value.type === AST_NODE_TYPES.Identifier) {
          const init = findVarInitInScope(context, node, value.name);
          if (init && isStringLiteralOrTemplateWithoutNls(init)) {
            context.report({ node: value, messageId: 'noLiteral' });
          }
        }
        return;
      }

      if (isPromptServiceWithProgressCall(node)) {
        const titleArg = node.arguments[0];
        if (!titleArg) return;

        if (isStringLiteralOrTemplateWithoutNls(titleArg as TSESTree.Expression)) {
          context.report({ node: titleArg, messageId: 'noLiteral' });
          return;
        }

        if (titleArg.type === AST_NODE_TYPES.Identifier) {
          const init = findVarInitInScope(context, node, titleArg.name);
          if (init && isStringLiteralOrTemplateWithoutNls(init)) {
            context.report({ node: titleArg, messageId: 'noLiteral' });
          }
        }
      }
    }
  })
});
