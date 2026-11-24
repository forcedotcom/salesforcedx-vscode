/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isSchemaIsCall = (node: TSESTree.Node): node is TSESTree.CallExpression =>
  node.type === AST_NODE_TYPES.CallExpression &&
  node.arguments.length > 0 &&
  node.arguments[0].type !== AST_NODE_TYPES.SpreadElement &&
  node.callee.type === AST_NODE_TYPES.MemberExpression &&
  !node.callee.computed &&
  node.callee.object.type === AST_NODE_TYPES.Identifier &&
  node.callee.object.name === 'Schema' &&
  node.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.property.name === 'is';

type WrapperFunction = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | TSESTree.FunctionDeclaration;

export const noSchemaIsWrapper = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: { description: 'Use Schema.is directly instead of named single-schema predicate wrappers' },
    schema: [],
    messages: {
      useSchemaIs: 'Use Schema.is(schema)(value) directly instead of a named single-schema predicate wrapper.'
    }
  },
  defaultOptions: [],
  create: context => {
    const checkFunction = (node: WrapperFunction): void => {
      if (
        node.async ||
        node.generator ||
        (node.type !== AST_NODE_TYPES.FunctionDeclaration &&
          node.parent.type !== AST_NODE_TYPES.VariableDeclarator &&
          !(
            (node.parent.type === AST_NODE_TYPES.Property ||
              node.parent.type === AST_NODE_TYPES.MethodDefinition ||
              node.parent.type === AST_NODE_TYPES.PropertyDefinition) &&
            node.parent.value === node
          ))
      )
        return;

      const statement = node.body.type === AST_NODE_TYPES.BlockStatement ? node.body.body[0] : undefined;
      const expression =
        node.body.type === AST_NODE_TYPES.BlockStatement
          ? node.body.body.length === 1 && statement?.type === AST_NODE_TYPES.ReturnStatement
            ? statement.argument
            : undefined
          : node.body;
      if (!expression) return;

      if (node.params.length === 0 && isSchemaIsCall(expression)) {
        context.report({ node, messageId: 'useSchemaIs' });
        return;
      }

      const parameter = node.params[0];
      if (
        node.params.length !== 1 ||
        parameter.type !== AST_NODE_TYPES.Identifier ||
        expression.type !== AST_NODE_TYPES.CallExpression ||
        expression.arguments.length !== 1 ||
        expression.arguments[0].type !== AST_NODE_TYPES.Identifier ||
        expression.arguments[0].name !== parameter.name ||
        !isSchemaIsCall(expression.callee)
      )
        return;

      // A schema or parse options derived from the argument make this more than a fixed predicate.
      const schemaCall = expression.callee;
      const variable = context.sourceCode.getDeclaredVariables(node).find(v => v.name === parameter.name);
      if (
        variable?.references.some(
          ref => ref.identifier.range[0] >= schemaCall.range[0] && ref.identifier.range[1] <= schemaCall.range[1]
        )
      )
        return;

      context.report({ node, messageId: 'useSchemaIs' });
    };

    return {
      VariableDeclarator: (node: TSESTree.VariableDeclarator): void => {
        if (node.id.type === AST_NODE_TYPES.Identifier && node.init && isSchemaIsCall(node.init)) {
          context.report({ node, messageId: 'useSchemaIs' });
        }
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction
    };
  }
});
