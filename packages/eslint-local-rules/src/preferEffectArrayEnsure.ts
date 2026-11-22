/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import { getNearestPackageJson } from './packageJsonUtils';

const sameKey = (left: TSESTree.Node, right: TSESTree.Node): boolean =>
  (left.type === AST_NODE_TYPES.Identifier && right.type === AST_NODE_TYPES.Identifier && left.name === right.name) ||
  (left.type === AST_NODE_TYPES.Literal &&
    right.type === AST_NODE_TYPES.Literal &&
    !('regex' in left) &&
    !('regex' in right) &&
    left.value === right.value);

/** Match only identifiers and property chains, never calls or computed expressions with side effects. */
const sameReference = (left: TSESTree.Node, right: TSESTree.Node): boolean => {
  if (left.type === AST_NODE_TYPES.Identifier && right.type === AST_NODE_TYPES.Identifier) {
    return left.name === right.name;
  }
  if (left.type === AST_NODE_TYPES.ChainExpression && right.type === AST_NODE_TYPES.ChainExpression) {
    return sameReference(left.expression, right.expression);
  }
  return (
    left.type === AST_NODE_TYPES.MemberExpression &&
    right.type === AST_NODE_TYPES.MemberExpression &&
    left.optional === right.optional &&
    left.computed === right.computed &&
    sameKey(left.property, right.property) &&
    sameReference(left.object, right.object)
  );
};

export const preferEffectArrayEnsure = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: { description: 'Prefer Effect Array.ensure for singleton-or-array normalization in Effect packages' },
    schema: [],
    messages: {
      useEnsure:
        "Use import * as Arr from 'effect/Array' and Arr.ensure({{value}}) for singleton-or-array normalization."
    }
  },
  defaultOptions: [],
  create: context => {
    const packageJson = getNearestPackageJson(context.physicalFilename);
    if (
      !packageJson.dependencies?.effect &&
      !packageJson.devDependencies?.effect &&
      !packageJson.peerDependencies?.effect
    ) {
      return {};
    }

    return {
      ConditionalExpression: (node: TSESTree.ConditionalExpression): void => {
        const condition = node.test;
        const negated = condition.type === AST_NODE_TYPES.UnaryExpression && condition.operator === '!';
        const test = negated ? condition.argument : condition;
        if (
          test.type !== AST_NODE_TYPES.CallExpression ||
          test.optional ||
          test.arguments.length !== 1 ||
          test.callee.type !== AST_NODE_TYPES.MemberExpression ||
          test.callee.computed ||
          test.callee.optional ||
          test.callee.object.type !== AST_NODE_TYPES.Identifier ||
          test.callee.object.name !== 'Array' ||
          test.callee.property.type !== AST_NODE_TYPES.Identifier ||
          test.callee.property.name !== 'isArray'
        ) {
          return;
        }

        // A locally defined Array may not have the built-in isArray behavior.
        const array = test.callee.object;
        if (context.sourceCode.getScope(test).references.find(ref => ref.identifier === array)?.resolved?.defs.length) {
          return;
        }

        const value = test.arguments[0];
        const passthrough = negated ? node.alternate : node.consequent;
        const wrapped = negated ? node.consequent : node.alternate;
        if (
          wrapped.type === AST_NODE_TYPES.ArrayExpression &&
          wrapped.elements.length === 1 &&
          wrapped.elements[0] &&
          sameReference(value, passthrough) &&
          sameReference(value, wrapped.elements[0])
        ) {
          context.report({ node, messageId: 'useEnsure', data: { value: context.sourceCode.getText(value) } });
        }
      }
    };
  }
});
