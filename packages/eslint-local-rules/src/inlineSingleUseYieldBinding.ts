/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

/** Only direct, immediate uses; moving the yield across another evaluation changes execution order. */
const reportableUse = (statement: TSESTree.Statement, reference: TSESTree.Identifier): boolean => {
  if (statement.type !== AST_NODE_TYPES.ReturnStatement && statement.type !== AST_NODE_TYPES.ExpressionStatement) {
    return false;
  }
  const expression = statement.type === AST_NODE_TYPES.ReturnStatement ? statement.argument : statement.expression;
  if (expression === reference && statement.type === AST_NODE_TYPES.ReturnStatement) return true;

  const value =
    expression?.type === AST_NODE_TYPES.YieldExpression && expression.delegate ? expression.argument : expression;
  if (value?.type !== AST_NODE_TYPES.CallExpression || value.callee.type !== AST_NODE_TYPES.Identifier) return false;
  return value.arguments[0] === reference;
};

export const inlineSingleUseYieldBinding = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: { description: 'Avoid a single-use yield* binding immediately before its use' },
    fixable: 'code',
    schema: [],
    messages: {
      inlineSingleUseYieldBinding: 'Remove this single-use yield* binding without changing evaluation order.'
    }
  },
  defaultOptions: [],
  create: context => ({
    VariableDeclaration: (node: TSESTree.VariableDeclaration): void => {
      if (node.kind !== 'const' || node.declarations.length !== 1) return;
      const declarator = node.declarations[0];
      const { id, init } = declarator;
      if (
        id.type !== AST_NODE_TYPES.Identifier ||
        init?.type !== AST_NODE_TYPES.YieldExpression ||
        !init.delegate ||
        !init.argument
      )
        return;
      const parent = node.parent;
      const statements =
        parent.type === AST_NODE_TYPES.BlockStatement
          ? parent.body
          : parent.type === AST_NODE_TYPES.SwitchCase
            ? parent.consequent
            : undefined;
      if (!statements) return;
      const next = statements[statements.indexOf(node) + 1];
      if (!next) return;

      const variable = context.sourceCode.getDeclaredVariables(declarator).find(v => v.name === id.name);
      const references = variable?.references.filter(ref => !ref.init) ?? [];
      if (references.length !== 1 || !references[0].isRead() || references[0].isWrite()) return;
      const reference = references[0].identifier;
      if (reference.type !== AST_NODE_TYPES.Identifier) return;
      if (!reportableUse(next, reference)) return;

      const sourceCode = context.sourceCode;
      const hasCommentOutsideInitializer = sourceCode
        .getAllComments()
        .some(
          comment =>
            comment.range[0] >= node.range[0] &&
            comment.range[1] <= next.range[0] &&
            (comment.range[0] < init.range[0] || comment.range[1] > init.range[1])
        );
      const directlyReturned = next.type === AST_NODE_TYPES.ReturnStatement && next.argument === reference;
      context.report({
        node,
        messageId: 'inlineSingleUseYieldBinding',
        ...(directlyReturned && !hasCommentOutsideInitializer
          ? {
              fix: fixer => [
                fixer.removeRange([node.range[0], next.range[0]]),
                fixer.replaceText(reference, sourceCode.getText(init))
              ]
            }
          : {})
      });
    }
  })
});
