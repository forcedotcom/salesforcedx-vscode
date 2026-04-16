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

/** Find the title property in a withProgress options object */
const findTitleProperty = (obj: TSESTree.ObjectExpression): TSESTree.Property | undefined => {
  const p = obj.properties.find(
    prop =>
      prop.type === AST_NODE_TYPES.Property &&
      prop.key.type === AST_NODE_TYPES.Identifier &&
      prop.key.name === 'title'
  );
  return p?.type === AST_NODE_TYPES.Property ? p : undefined;
};

/** Check if this is vscode.window.withProgress or window.withProgress */
const isVscodeWithProgressCall = (node: TSESTree.CallExpression): boolean => {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.property.type !== AST_NODE_TYPES.Identifier || callee.property.name !== 'withProgress') {
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

/** Check if this is a promptService.withProgress(title) call (title as first arg, not in options object) */
const isPromptServiceWithProgressCall = (node: TSESTree.CallExpression): boolean =>
  node.callee.type === AST_NODE_TYPES.MemberExpression &&
  node.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.property.name === 'withProgress' &&
  !isVscodeWithProgressCall(node) &&
  node.arguments[0]?.type !== AST_NODE_TYPES.ObjectExpression;

const checkIdentifierForLiteral = (
  value: TSESTree.Identifier,
  node: TSESTree.CallExpression,
  context: Parameters<Parameters<typeof RuleCreator.withoutDocs>[0]['create']>[0]
): void => {
  let currentScope: ReturnType<typeof context.sourceCode.getScope> | null = context.sourceCode.getScope(node);
  while (currentScope) {
    const variable = currentScope.variables.find(v => v.name === value.name);
    if (variable?.defs[0]) {
      const defNode = variable.defs[0].node;
      if (defNode.type === AST_NODE_TYPES.VariableDeclarator && defNode.init) {
        if (isStringLiteralOrTemplateWithoutNls(defNode.init)) {
          context.report({ node: value, messageId: 'noLiteral' });
        }
      }
      return;
    }
    currentScope = currentScope.upper;
  }
};

export const noVscodeProgressTitleLiterals = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow string literals in withProgress title - use nls.localize() or variables instead'
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
      if (isVscodeWithProgressCall(node)) {
        const optionsArg = node.arguments[0];
        if (optionsArg?.type !== AST_NODE_TYPES.ObjectExpression) return;

        const titleProp = findTitleProperty(optionsArg);
        if (!titleProp?.value) return;

        const value = titleProp.value;
        if (value.type === AST_NODE_TYPES.AssignmentPattern) return;

        if (isStringLiteralOrTemplateWithoutNls(value as TSESTree.Expression)) {
          context.report({ node: value, messageId: 'noLiteral' });
          return;
        }

        if (value.type === AST_NODE_TYPES.Identifier) {
          checkIdentifierForLiteral(value, node, context);
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
          checkIdentifierForLiteral(titleArg, node, context);
        }
      }
    }
  })
});
