/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isEffectEffectType = (typeAnnotation: TSESTree.TSTypeAnnotation | undefined): boolean => {
  if (!typeAnnotation) return false;

  const type = typeAnnotation.typeAnnotation;
  if (type.type !== AST_NODE_TYPES.TSTypeReference) return false;

  const typeName = type.typeName;
  if (typeName.type === AST_NODE_TYPES.TSQualifiedName) {
    return (
      typeName.left.type === AST_NODE_TYPES.Identifier &&
      typeName.left.name === 'Effect' &&
      typeName.right.type === AST_NODE_TYPES.Identifier &&
      typeName.right.name === 'Effect'
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
      description: 'Prevent explicit return type annotations when the return type is Effect.Effect'
    },
    fixable: 'code',
    schema: [],
    messages: {
      noExplicitEffectReturnType:
        'Do not declare explicit return types for Effect.Effect. Let TypeScript infer the return type.'
    }
  },
  defaultOptions: [],
  create: context => {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

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
        if (isEffectEffectType(node.returnType)) {
          context.report({
            node: node.returnType!,
            messageId: 'noExplicitEffectReturnType',
            fix: createFix(node.returnType!)
          });
        }
      },
      ArrowFunctionExpression: (node: TSESTree.ArrowFunctionExpression): void => {
        if (isEffectEffectType(node.returnType)) {
          context.report({
            node: node.returnType!,
            messageId: 'noExplicitEffectReturnType',
            fix: createFix(node.returnType!)
          });
        }
      },
      MethodDefinition: (node: TSESTree.MethodDefinition): void => {
        if (isEffectEffectType(node.value.returnType)) {
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
        if (isEffectEffectType(node.returnType)) {
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
