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

/** Check if an expression is a string literal or template literal without nls.localize() */
const isStringLiteralOrTemplateWithoutNls = (expr: TSESTree.Expression): boolean => {
  if (expr.type === AST_NODE_TYPES.Literal && typeof expr.value === 'string') {
    return true;
  }
  if (expr.type === AST_NODE_TYPES.TemplateLiteral) {
    return !expr.expressions.some(isNlsLocalizeCall);
  }
  return false;
};

/** Check if this is vscode.window.showQuickPick or window.showQuickPick */
const isShowQuickPickCall = (node: TSESTree.CallExpression): boolean => {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.property.type !== AST_NODE_TYPES.Identifier || callee.property.name !== 'showQuickPick') {
    return false;
  }
  if (callee.object.type === AST_NODE_TYPES.MemberExpression) {
    return (
      callee.object.object.type === AST_NODE_TYPES.Identifier &&
      callee.object.object.name === 'vscode' &&
      callee.object.property.type === AST_NODE_TYPES.Identifier &&
      callee.object.property.name === 'window'
    );
  }
  if (callee.object.type === AST_NODE_TYPES.Identifier) {
    return callee.object.name === 'window';
  }
  return false;
};

/** Find the description property in a Quick Pick item object */
const findDescriptionProperty = (obj: TSESTree.ObjectExpression): TSESTree.Property | undefined => {
  const p = obj.properties.find(
    prop =>
      prop.type === AST_NODE_TYPES.Property &&
      prop.key.type === AST_NODE_TYPES.Identifier &&
      prop.key.name === 'description'
  );
  return p?.type === AST_NODE_TYPES.Property ? p : undefined;
};

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
      if (!isShowQuickPickCall(node)) return;

      const itemsArg = node.arguments[0];
      if (itemsArg?.type !== AST_NODE_TYPES.ArrayExpression) return;

      for (const element of itemsArg.elements) {
        if (element?.type !== AST_NODE_TYPES.ObjectExpression) continue;
        const descProp = findDescriptionProperty(element);
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
