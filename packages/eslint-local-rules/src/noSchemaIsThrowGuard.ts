/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isSchemaIsResult = (node: TSESTree.Expression): boolean =>
  node.type === AST_NODE_TYPES.CallExpression &&
  node.callee.type === AST_NODE_TYPES.CallExpression &&
  node.callee.callee.type === AST_NODE_TYPES.MemberExpression &&
  !node.callee.callee.computed &&
  node.callee.callee.object.type === AST_NODE_TYPES.Identifier &&
  node.callee.callee.object.name === 'Schema' &&
  node.callee.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.callee.property.name === 'is';

/** Only statements that cannot return, break, continue, or conditionally skip the throw. */
const canPrecedeThrow = (node: TSESTree.Statement): boolean =>
  node.type === AST_NODE_TYPES.ExpressionStatement ||
  node.type === AST_NODE_TYPES.VariableDeclaration ||
  node.type === AST_NODE_TYPES.EmptyStatement ||
  node.type === AST_NODE_TYPES.FunctionDeclaration;

const alwaysThrows = (node: TSESTree.Statement | null | undefined, followingThrows = false): boolean => {
  if (!node) return followingThrows;
  if (node.type === AST_NODE_TYPES.ThrowStatement) return true;
  if (node.type === AST_NODE_TYPES.BlockStatement) {
    return node.body.reduceRight((throwsAfter, statement) => alwaysThrows(statement, throwsAfter), followingThrows);
  }
  if (node.type === AST_NODE_TYPES.IfStatement) {
    return alwaysThrows(node.consequent, followingThrows) && alwaysThrows(node.alternate, followingThrows);
  }
  return canPrecedeThrow(node) && followingThrows;
};

export const noSchemaIsThrowGuard = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: { description: 'Keep schema validation failures and messages on Effect Schema declarations' },
    schema: [],
    messages: {
      useSchemaValidation:
        'Use Schema.asserts or Schema.decodeUnknownSync instead of a Schema.is throw guard. Define the validation message on the schema with Schema.annotations or a Schema.filter failure message.'
    }
  },
  defaultOptions: [],
  create: context => {
    const isSchemaBoolean = (node: TSESTree.Expression): boolean => {
      if (isSchemaIsResult(node)) return true;
      if (node.type !== AST_NODE_TYPES.Identifier) return false;
      const variable = context.sourceCode.getScope(node).references.find(ref => ref.identifier === node)?.resolved;
      const definition = variable?.defs[0]?.node;
      return (
        definition?.type === AST_NODE_TYPES.VariableDeclarator &&
        definition.init !== null &&
        isSchemaIsResult(definition.init) &&
        !variable?.references.some(ref => ref.isWrite() && !ref.init && ref.identifier.range[0] < node.range[0])
      );
    };

    return {
      IfStatement: (node: TSESTree.IfStatement): void => {
        const condition = node.test;
        const negated = condition.type === AST_NODE_TYPES.UnaryExpression && condition.operator === '!';
        const test = negated ? condition.argument : condition;
        if (!isSchemaBoolean(test) || !alwaysThrows(negated ? node.consequent : node.alternate)) return;
        context.report({ node: node.test, messageId: 'useSchemaValidation' });
      }
    };
  }
});
