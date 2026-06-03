/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

// Detect a Playwright assertion (`expect(...)`) whose rejection is swallowed.
//
// Two sink shapes:
// 1. try { ...expect(...)... } catch { /* empty or log-only */ }
// 2. expect(...).<chain>.catch(<empty-or-log-only>)
//
// NOT flagged:
// - .catch() on plain Playwright APIs (e.g. locator.isVisible().catch(() => false))
// - cleanup .catch(() => {}) on non-`expect` chains
// - aliased imports of `expect` (rule matches identifier name `expect` only)

/** Recursive walk: returns true if subtree contains a CallExpression to identifier `expect`. */
const containsExpectCall = (node: TSESTree.Node | undefined | null): boolean => {
  if (!node) return false;
  if (
    node.type === AST_NODE_TYPES.CallExpression &&
    node.callee.type === AST_NODE_TYPES.Identifier &&
    node.callee.name === 'expect'
  ) {
    return true;
  }
  // Walk all child node-shaped properties.
  for (const key of Object.keys(node) as (keyof TSESTree.Node)[]) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const value = (node as unknown as Record<string, unknown>)[key as string];
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && 'type' in item && containsExpectCall(item as TSESTree.Node)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && 'type' in value) {
      if (containsExpectCall(value as TSESTree.Node)) return true;
    }
  }
  return false;
};

/** Walk a chain `a.b().c().d` and return true if any CallExpression in the receiver chain calls `expect`. */
const chainContainsExpectCall = (node: TSESTree.Node | undefined | null): boolean => {
  let current: TSESTree.Node | undefined | null = node;
  while (current) {
    if (
      current.type === AST_NODE_TYPES.CallExpression &&
      current.callee.type === AST_NODE_TYPES.Identifier &&
      current.callee.name === 'expect'
    ) {
      return true;
    }
    if (current.type === AST_NODE_TYPES.CallExpression) {
      current = current.callee;
    } else if (current.type === AST_NODE_TYPES.MemberExpression) {
      current = current.object;
    } else {
      return false;
    }
  }
  return false;
};

const LOG_IDENT_RE = /^(log|logger|debug|trace)$/i;

/** A statement that is a plain logging call — `console.x(...)` or `log/logger/debug/trace.x(...)` or `log(...)`. */
const isLoggingStatement = (stmt: TSESTree.Statement): boolean => {
  if (stmt.type !== AST_NODE_TYPES.ExpressionStatement) return false;
  const expr = stmt.expression;
  if (expr.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = expr.callee;
  if (callee.type === AST_NODE_TYPES.Identifier && LOG_IDENT_RE.test(callee.name)) return true;
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    (callee.object.name === 'console' || LOG_IDENT_RE.test(callee.object.name))
  ) {
    return true;
  }
  return false;
};

/** True when a block body is empty or contains only logging statements (no throw/return/other calls). */
const isSwallowingBlock = (block: TSESTree.BlockStatement): boolean => block.body.every(isLoggingStatement);

/**
 * Whether the catch handler / arrow function "swallows" the rejection.
 * - Empty body: yes
 * - Block of only logging statements: yes
 * - Any throw / return-with-arg / non-logging call: no
 * - Arrow expression body that's a literal/identifier/etc (e.g. `() => false`, `() => undefined`): yes
 */
const isSwallowingHandler = (
  handler: TSESTree.CatchClause | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
): boolean => {
  if (handler.type === AST_NODE_TYPES.CatchClause) {
    return isSwallowingBlock(handler.body);
  }
  // Arrow / Function
  if (handler.body.type === AST_NODE_TYPES.BlockStatement) {
    return isSwallowingBlock(handler.body);
  }
  // Arrow with expression body — discards rejection regardless of expression value.
  return true;
};

export const noSwallowedRejection = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow swallowed rejections of Playwright `expect(...)` assertions via empty/log-only try-catch or .catch().'
    },
    schema: [],
    messages: {
      swallowedRejection:
        'Empty or log-only catch swallows expect() rejection. Re-throw, assert via expect.poll/toPass, or remove the assertion.'
    }
  },
  defaultOptions: [],
  create: context => ({
    TryStatement: (node: TSESTree.TryStatement): void => {
      if (!node.handler) return;
      if (!containsExpectCall(node.block)) return;
      if (!isSwallowingHandler(node.handler)) return;
      context.report({ node: node.handler, messageId: 'swallowedRejection' });
    },
    CallExpression: (node: TSESTree.CallExpression): void => {
      const callee = node.callee;
      if (
        callee.type !== AST_NODE_TYPES.MemberExpression ||
        callee.property.type !== AST_NODE_TYPES.Identifier ||
        callee.property.name !== 'catch'
      ) {
        return;
      }
      if (!chainContainsExpectCall(callee.object)) return;
      const handler = node.arguments[0];
      if (
        !handler ||
        (handler.type !== AST_NODE_TYPES.ArrowFunctionExpression && handler.type !== AST_NODE_TYPES.FunctionExpression)
      ) {
        return;
      }
      if (!isSwallowingHandler(handler)) return;
      context.report({ node, messageId: 'swallowedRejection' });
    }
  })
});
