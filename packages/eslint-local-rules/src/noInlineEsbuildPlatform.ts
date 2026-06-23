/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import { isEsbuildPlatformAccess, isProcessEnvAccess } from './astUtils';

// Only a binary comparison lets esbuild `define` strip the dead branch (ADR 0013).
const COMPARISON_OPERATORS = new Set(['===', '!==', '==', '!=']);

// Allowed only when compared against a string literal: esbuild folds `'web' === 'web'`,
// not `'web' === someVar`, so a non-literal operand leaves the dead branch in the bundle.
const isAllowedComparison = (node: TSESTree.MemberExpression): boolean => {
  const parent = node.parent;
  if (parent.type !== AST_NODE_TYPES.BinaryExpression || !COMPARISON_OPERATORS.has(parent.operator)) return false;
  const sibling = parent.left === node ? parent.right : parent.left;
  return sibling.type === AST_NODE_TYPES.Literal && typeof sibling.value === 'string';
};

export const noInlineEsbuildPlatform = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Use process.env.ESBUILD_PLATFORM only as an inline literal in a comparison so esbuild can strip the dead branch.'
    },
    schema: [],
    messages: {
      inlineLiteral:
        'process.env.ESBUILD_PLATFORM must be used inline in a comparison against a string literal (e.g. === "web"). Assigning it to a variable, property, destructuring it, or comparing against a non-literal defeats esbuild dead-branch stripping (ADR 0013).'
    }
  },
  defaultOptions: [],
  create: context => ({
    MemberExpression: (node: TSESTree.MemberExpression): void => {
      if (isEsbuildPlatformAccess(node) && !isAllowedComparison(node)) {
        context.report({ node, messageId: 'inlineLiteral' });
      }
    },
    // `const { ESBUILD_PLATFORM } = process.env` (or assignment-pattern
    // `({ ESBUILD_PLATFORM } = process.env)`) extracts the literal into a binding.
    ObjectPattern: (node: TSESTree.ObjectPattern): void => {
      const source =
        node.parent.type === AST_NODE_TYPES.VariableDeclarator
          ? node.parent.init
          : node.parent.type === AST_NODE_TYPES.AssignmentExpression
            ? node.parent.right
            : undefined;
      if (!source || !isProcessEnvAccess(source)) return;
      const destructured = node.properties.find(
        (prop): prop is TSESTree.Property =>
          prop.type === AST_NODE_TYPES.Property &&
          prop.key.type === AST_NODE_TYPES.Identifier &&
          prop.key.name === 'ESBUILD_PLATFORM'
      );
      if (destructured) {
        context.report({ node: destructured, messageId: 'inlineLiteral' });
      }
    }
  })
});
