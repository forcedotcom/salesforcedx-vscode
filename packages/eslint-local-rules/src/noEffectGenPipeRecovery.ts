/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isEffectGenCall = (node: TSESTree.Node): node is TSESTree.CallExpression =>
  node.type === AST_NODE_TYPES.CallExpression &&
  node.callee.type === AST_NODE_TYPES.MemberExpression &&
  !node.callee.computed &&
  !node.callee.optional &&
  node.callee.object.type === AST_NODE_TYPES.Identifier &&
  node.callee.object.name === 'Effect' &&
  node.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.property.name === 'gen';

const isRecovery = (node: TSESTree.Node): boolean => {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed || callee.optional) return false;
  return (
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === 'Effect' &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    (callee.property.name === 'orElseSucceed' ||
      callee.property.name === 'catchAll' ||
      callee.property.name === 'catchAllCause' ||
      callee.property.name.startsWith('catchTag'))
  );
};

export const noEffectGenPipeRecovery = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Pipe recovery from the first Effect of the recovered span, not from Effect.gen'
    },
    schema: [],
    messages: {
      noEffectGenPipeRecovery: 'Pipe recovery from the first Effect of the recovered span, not from Effect.gen.'
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      const callee = node.callee;
      if (
        callee.type !== AST_NODE_TYPES.MemberExpression ||
        callee.computed ||
        callee.optional ||
        callee.property.type !== AST_NODE_TYPES.Identifier ||
        callee.property.name !== 'pipe' ||
        !isEffectGenCall(callee.object) ||
        !node.arguments.some(isRecovery)
      )
        return;

      context.report({ node: callee.object, messageId: 'noEffectGenPipeRecovery' });
    }
  })
});
