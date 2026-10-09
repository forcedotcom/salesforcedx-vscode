/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import { isEffectFnCall } from './noEffectFnWrapper';

const CATCH_METHODS = [
  'catch',
  'catchAll',
  'catchAllCause',
  'catchCause',
  'catchCauseIf',
  'catchIf',
  'catchSome',
  'catchSomeCause',
  'catchTag',
  'catchTags'
] as const;

const isEffectCall = (node: TSESTree.Node, method: string): node is TSESTree.CallExpression => {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed || callee.optional) return false;
  const { object, property } = callee;
  return (
    object.type === AST_NODE_TYPES.Identifier &&
    object.name === 'Effect' &&
    property.type === AST_NODE_TYPES.Identifier &&
    property.name === method
  );
};

const isCatchMiddleware = (node: TSESTree.Node): node is TSESTree.CallExpression =>
  CATCH_METHODS.some(method => isEffectCall(node, method));

const calleeIdentifierName = (callee: TSESTree.CallExpression['callee']): string | undefined => {
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;
  if (
    callee.type !== AST_NODE_TYPES.MemberExpression ||
    callee.computed ||
    callee.property.type !== AST_NODE_TYPES.Identifier
  ) {
    return undefined;
  }
  return callee.property.name;
};

const isSuccessNotificationCall = (node: TSESTree.Node): boolean => {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const name = calleeIdentifierName(node.callee);
  return name?.includes('SuccessNotification') === true;
};

const isSuccessOnly = (node: TSESTree.Node): boolean => isEffectCall(node, 'tap') || isSuccessNotificationCall(node);

export const effectFnCatchMiddlewareLast = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Effect.fn success middleware (Effect.tap or a success-notification call) must come before catch middleware'
    },
    schema: [],
    messages: {
      successAfterCatch:
        'Put Effect.tap and success notifications before Effect.fn catch middleware. A success combinator after catch runs on the recovered value.'
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (isEffectFnCall(node) === undefined) return;
      const middleware = node.arguments.slice(1);
      middleware
        .filter(
          (arg, index): arg is TSESTree.CallExpression =>
            isCatchMiddleware(arg) && middleware.slice(index + 1).some(isSuccessOnly)
        )
        .forEach(arg => context.report({ node: arg, messageId: 'successAfterCatch' }));
    }
  })
});
