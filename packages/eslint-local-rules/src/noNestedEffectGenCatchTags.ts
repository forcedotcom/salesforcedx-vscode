/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isEffectCall = (node: TSESTree.Node, method: 'fn' | 'gen' | 'catchTags'): node is TSESTree.CallExpression => {
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

const isEffectFnCallback = (fn: TSESTree.Node): fn is TSESTree.FunctionExpression => {
  if (fn.type !== AST_NODE_TYPES.FunctionExpression || !fn.generator) return false;
  const parent = fn.parent;
  if (parent?.type !== AST_NODE_TYPES.CallExpression || parent.arguments[0] !== fn) return false;
  const callee = parent.callee;
  return callee.type === AST_NODE_TYPES.CallExpression && isEffectCall(callee, 'fn');
};

const isGeneratorFunction = (node: TSESTree.Node): node is TSESTree.FunctionExpression | TSESTree.FunctionDeclaration =>
  (node.type === AST_NODE_TYPES.FunctionExpression || node.type === AST_NODE_TYPES.FunctionDeclaration) &&
  node.generator;

const pipeHasCatchTags = (genCall: TSESTree.CallExpression): boolean => {
  const member = genCall.parent;
  if (
    member?.type !== AST_NODE_TYPES.MemberExpression ||
    member.computed ||
    member.optional ||
    member.object !== genCall ||
    member.property.type !== AST_NODE_TYPES.Identifier ||
    member.property.name !== 'pipe'
  ) {
    return false;
  }
  const pipeCall = member.parent;
  if (pipeCall?.type !== AST_NODE_TYPES.CallExpression || pipeCall.callee !== member) return false;
  return pipeCall.arguments.some(arg => isEffectCall(arg, 'catchTags'));
};

export const noNestedEffectGenCatchTags = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Inside Effect.fn, pipe catchTags from the first Effect. Do not wrap that span in Effect.gen.'
    },
    schema: [],
    messages: {
      noNestedEffectGenCatchTags:
        'Inside Effect.fn, pipe catchTags from the first Effect. Do not wrap that span in Effect.gen.'
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (!isEffectCall(node, 'gen') || !pipeHasCatchTags(node)) return;
      const generator = context.sourceCode.getAncestors(node).findLast(isGeneratorFunction);
      if (generator === undefined || !isEffectFnCallback(generator)) return;
      context.report({ node, messageId: 'noNestedEffectGenCatchTags' });
    }
  })
});
