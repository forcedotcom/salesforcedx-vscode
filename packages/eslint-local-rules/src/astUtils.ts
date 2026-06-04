/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

export type RuleContext = Parameters<Parameters<typeof RuleCreator.withoutDocs>[0]['create']>[0];

/** Type predicate: node is a `nls.localize(...)` CallExpression */
export const isNlsLocalizeCall = (node: TSESTree.Node): node is TSESTree.CallExpression =>
  node.type === AST_NODE_TYPES.CallExpression &&
  node.callee.type === AST_NODE_TYPES.MemberExpression &&
  node.callee.object.type === AST_NODE_TYPES.Identifier &&
  node.callee.object.name === 'nls' &&
  node.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.property.name === 'localize';

/** Check if an expression is a string literal or template literal without nls.localize() */
export const isStringLiteralOrTemplateWithoutNls = (expr: TSESTree.Expression): boolean => {
  if (expr.type === AST_NODE_TYPES.Literal && typeof expr.value === 'string') {
    return true;
  }
  if (expr.type === AST_NODE_TYPES.TemplateLiteral) {
    return !expr.expressions.some(isNlsLocalizeCall);
  }
  return false;
};

/**
 * Check if `node` is a member call on `vscode.window.<methodName>` or `window.<methodName>`.
 * `methodName` may be a string (exact match) or RegExp (pattern match).
 */
export const isVscodeWindowMethodCall = (node: TSESTree.CallExpression, methodName: string | RegExp): boolean => {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  const propName = callee.property.name;
  const matches = typeof methodName === 'string' ? propName === methodName : methodName.test(propName);
  if (!matches) return false;

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

/** Find a property by name in an ObjectExpression */
export const findObjectProperty = (obj: TSESTree.ObjectExpression, name: string): TSESTree.Property | undefined => {
  const p = obj.properties.find(
    prop =>
      prop.type === AST_NODE_TYPES.Property && prop.key.type === AST_NODE_TYPES.Identifier && prop.key.name === name
  );
  return p?.type === AST_NODE_TYPES.Property ? p : undefined;
};

/**
 * Walk scope chain from `node` outward looking for a VariableDeclarator named `name`.
 * Returns its `init` expression if found, otherwise undefined.
 * Returns undefined if the variable is found but lacks an `init`.
 */
export const findVarInitInScope = (
  context: RuleContext,
  node: TSESTree.Node,
  name: string
): TSESTree.Expression | undefined => {
  let currentScope: ReturnType<typeof context.sourceCode.getScope> | null = context.sourceCode.getScope(node);
  while (currentScope) {
    const variable = currentScope.variables.find(v => v.name === name);
    if (variable?.defs[0]) {
      const defNode = variable.defs[0].node;
      if (defNode.type === AST_NODE_TYPES.VariableDeclarator && defNode.init) {
        return defNode.init;
      }
      return undefined;
    }
    currentScope = currentScope.upper;
  }
  return undefined;
};
