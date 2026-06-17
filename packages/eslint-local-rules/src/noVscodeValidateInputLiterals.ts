/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

import { findObjectProperty, isNlsLocalizeCall, isVscodeWindowMethodCall } from './astUtils';

/** Collect all string literal nodes in an expression that would be returned as error message */
const collectStringLiteralNodes = (expr: TSESTree.Expression | null | undefined, out: TSESTree.Node[]): void => {
  if (!expr) return;
  if (isNlsLocalizeCall(expr)) return;
  if (expr.type === AST_NODE_TYPES.Literal && typeof expr.value === 'string') {
    out.push(expr);
    return;
  }
  if (expr.type === AST_NODE_TYPES.TemplateLiteral && !expr.expressions.some(isNlsLocalizeCall)) {
    out.push(expr);
    return;
  }
  if (expr.type === AST_NODE_TYPES.ConditionalExpression) {
    collectStringLiteralNodes(expr.consequent, out);
    collectStringLiteralNodes(expr.alternate, out);
    return;
  }
  if (expr.type === AST_NODE_TYPES.LogicalExpression) {
    collectStringLiteralNodes(expr.left, out);
    collectStringLiteralNodes(expr.right, out);
  }
};

/** Recursively collect all ReturnStatement nodes from a block or statement */
const collectReturnStatements = (node: TSESTree.Node, out: TSESTree.ReturnStatement[]): void => {
  if (node.type === AST_NODE_TYPES.ReturnStatement) {
    out.push(node);
    return;
  }
  if (node.type === AST_NODE_TYPES.BlockStatement) {
    for (const stmt of node.body) {
      collectReturnStatements(stmt, out);
    }
    return;
  }
  if (node.type === AST_NODE_TYPES.IfStatement) {
    collectReturnStatements(node.consequent, out);
    if (node.alternate) collectReturnStatements(node.alternate, out);
    return;
  }
  if (node.type === AST_NODE_TYPES.SwitchCase) {
    for (const stmt of node.consequent) {
      collectReturnStatements(stmt, out);
    }
  }
};

/** Traverse function body for ReturnStatement nodes and collect string literals */
const checkValidateInputFunction = (
  fn: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  context: { report: (opts: { node: TSESTree.Node; messageId: 'noLiteral' }) => void }
): void => {
  const body = fn.body;
  const returnStmts: TSESTree.ReturnStatement[] = [];
  if (body.type === AST_NODE_TYPES.BlockStatement) {
    for (const stmt of body.body) {
      collectReturnStatements(stmt, returnStmts);
    }
  } else {
    returnStmts.push({ type: AST_NODE_TYPES.ReturnStatement, argument: body } as TSESTree.ReturnStatement);
  }

  for (const stmt of returnStmts) {
    if (!stmt.argument) continue;
    const literals: TSESTree.Node[] = [];
    collectStringLiteralNodes(stmt.argument as TSESTree.Expression, literals);
    for (const node of literals) {
      context.report({ node, messageId: 'noLiteral' });
    }
  }
};

export const noVscodeValidateInputLiterals = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow string literals in showInputBox validateInput - use nls.localize() for error messages'
    },
    schema: [],
    messages: {
      noLiteral:
        "showInputBox validateInput must use nls.localize('message_key') for error messages, not string literals. Add the message to i18n.ts and use nls.localize() to reference it."
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (!isVscodeWindowMethodCall(node, 'showInputBox')) return;

      const optionsArg = node.arguments[0];
      if (optionsArg?.type !== AST_NODE_TYPES.ObjectExpression) return;

      const validateInputProp = findObjectProperty(optionsArg, 'validateInput');
      if (!validateInputProp?.value) return;

      const value = validateInputProp.value;
      if (value.type === AST_NODE_TYPES.Identifier) return; // External function - skip

      if (value.type === AST_NODE_TYPES.ArrowFunctionExpression || value.type === AST_NODE_TYPES.FunctionExpression) {
        checkValidateInputFunction(value, context);
      }
    }
  })
});
