/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isEffectFnDirectCall = (
  node: TSESTree.CallExpression
): node is TSESTree.CallExpression & { arguments: [TSESTree.FunctionExpression] } => {
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const obj = callee.object;
  const prop = callee.property;
  if (obj.type !== AST_NODE_TYPES.Identifier || obj.name !== 'Effect') return false;
  if (prop.type !== AST_NODE_TYPES.Identifier || prop.name !== 'fn') return false;

  const arg = node.arguments[0];
  return (
    arg?.type === AST_NODE_TYPES.FunctionExpression &&
    arg.generator === true
  );
};

export const requireEffectFnSpanName = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Effect.fn requires a span name for tracing, e.g. Effect.fn("Module.functionName")(function* () {})'
    },
    schema: [],
    messages: {
      requireSpanName:
        'Effect.fn must include a span name for tracing. Use Effect.fn("Module.functionName")(function* () { ... })'
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (!isEffectFnDirectCall(node)) return;
      context.report({ node, messageId: 'requireSpanName' });
    }
  })
});
