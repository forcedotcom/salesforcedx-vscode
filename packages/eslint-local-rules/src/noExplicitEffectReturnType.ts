/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isEffectReturnType = (typeAnnotation: TSESTree.TSTypeAnnotation | undefined): boolean => {
  if (!typeAnnotation) return false;

  const type = typeAnnotation.typeAnnotation;
  if (type.type !== AST_NODE_TYPES.TSTypeReference) return false;

  const typeName = type.typeName;
  if (typeName.type === AST_NODE_TYPES.TSQualifiedName) {
    return (
      typeName.left.type === AST_NODE_TYPES.Identifier &&
      typeName.right.type === AST_NODE_TYPES.Identifier &&
      ((typeName.left.name === 'Effect' && typeName.right.name === 'Effect') ||
        (typeName.left.name === 'Layer' && typeName.right.name === 'Layer'))
    );
  }

  if (typeName.type === AST_NODE_TYPES.Identifier) {
    return typeName.name === 'Effect';
  }

  return false;
};

export const noExplicitEffectReturnType = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent explicit Effect.Effect or Layer.Layer return annotations'
    },
    fixable: 'code',
    schema: [],
    messages: {
      noExplicitEffectReturnType:
        'Do not declare explicit return types for Effect.Effect or Layer.Layer. Let TypeScript infer the return type.'
    }
  },
  defaultOptions: [],
  create: context => {
    const sourceCode = context.sourceCode;

    const createFix =
      (returnTypeNode: TSESTree.TSTypeAnnotation) =>
      (fixer: {
        removeRange: (range: readonly [number, number]) => { range: readonly [number, number]; text: string };
      }) => {
        if (!returnTypeNode.range) return null;

        const beforeToken = sourceCode.getTokenBefore(returnTypeNode);
        if (!beforeToken) return null;

        const start = beforeToken.range[1];
        const end = returnTypeNode.range[1];

        return fixer.removeRange([start, end] as const);
      };

    return {
      FunctionDeclaration: (node: TSESTree.FunctionDeclaration): void => {
        if (isEffectReturnType(node.returnType)) {
          context.report({
            node: node.returnType!,
            messageId: 'noExplicitEffectReturnType',
            fix: createFix(node.returnType!)
          });
        }
      },
      ArrowFunctionExpression: (node: TSESTree.ArrowFunctionExpression): void => {
        if (isEffectReturnType(node.returnType)) {
          context.report({
            node: node.returnType!,
            messageId: 'noExplicitEffectReturnType',
            fix: createFix(node.returnType!)
          });
        }
      },
      MethodDefinition: (node: TSESTree.MethodDefinition): void => {
        if (isEffectReturnType(node.value.returnType)) {
          context.report({
            node: node.value.returnType!,
            messageId: 'noExplicitEffectReturnType',
            fix: createFix(node.value.returnType!)
          });
        }
      },
      FunctionExpression: (node: TSESTree.FunctionExpression): void => {
        const parent = node.parent;
        if (parent?.type === AST_NODE_TYPES.MethodDefinition) {
          return;
        }
        if (isEffectReturnType(node.returnType)) {
          context.report({
            node: node.returnType!,
            messageId: 'noExplicitEffectReturnType',
            fix: createFix(node.returnType!)
          });
        }
      }
    };
  }
});
