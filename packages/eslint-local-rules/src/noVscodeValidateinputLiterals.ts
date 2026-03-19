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

/** Collect all string literal nodes in an expression that would be returned as error message */
const collectStringLiteralNodes = (
  expr: TSESTree.Expression | null | undefined,
  out: TSESTree.Node[]
): void => {
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

/** Check if this is vscode.window.showInputBox or window.showInputBox */
const isShowInputBoxCall = (node: TSESTree.CallExpression): boolean => {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.property.type !== AST_NODE_TYPES.Identifier || callee.property.name !== 'showInputBox') {
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

/** Find the validateInput property in showInputBox options */
const findValidateInputProperty = (obj: TSESTree.ObjectExpression): TSESTree.Property | undefined => {
  const p = obj.properties.find(
    prop =>
      prop.type === AST_NODE_TYPES.Property &&
      prop.key.type === AST_NODE_TYPES.Identifier &&
      prop.key.name === 'validateInput'
  );
  return p?.type === AST_NODE_TYPES.Property ? p : undefined;
};

/** Recursively collect all ReturnStatement nodes from a block or statement */
const collectReturnStatements = (
  node: TSESTree.Node,
  out: TSESTree.ReturnStatement[]
): void => {
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

export const noVscodeValidateinputLiterals = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow string literals in showInputBox validateInput - use nls.localize() for error messages'
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
      if (!isShowInputBoxCall(node)) return;

      const optionsArg = node.arguments[0];
      if (optionsArg?.type !== AST_NODE_TYPES.ObjectExpression) return;

      const validateInputProp = findValidateInputProperty(optionsArg);
      if (!validateInputProp?.value) return;

      const value = validateInputProp.value;
      if (value.type === AST_NODE_TYPES.Identifier) return; // External function - skip

      if (
        value.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        value.type === AST_NODE_TYPES.FunctionExpression
      ) {
        checkValidateInputFunction(value, context);
      }
    }
  })
});
