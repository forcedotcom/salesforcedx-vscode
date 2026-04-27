/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isVscodeUriType = (typeName: TSESTree.EntityName): boolean =>
  typeName.type === AST_NODE_TYPES.TSQualifiedName &&
  typeName.left.type === AST_NODE_TYPES.Identifier &&
  typeName.left.name === 'vscode' &&
  typeName.right.type === AST_NODE_TYPES.Identifier &&
  typeName.right.name === 'Uri';

const isVscodeUriFileOrParse = (callee: TSESTree.CallExpression['callee']): boolean => {
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const obj = callee.object;
  const prop = callee.property;
  if (obj.type !== AST_NODE_TYPES.MemberExpression) return false;
  return (
    obj.object.type === AST_NODE_TYPES.Identifier &&
    obj.object.name === 'vscode' &&
    obj.property.type === AST_NODE_TYPES.Identifier &&
    obj.property.name === 'Uri' &&
    prop.type === AST_NODE_TYPES.Identifier &&
    (prop.name === 'file' || prop.name === 'parse')
  );
};

export const noVscodeUri = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Use URI from vscode-uri, not vscode.Uri. Import { URI } from "vscode-uri".'
    },
    schema: [],
    messages: {
      useVscodeUri: 'Use URI from vscode-uri instead of vscode.Uri. Import { URI } from "vscode-uri".'
    }
  },
  defaultOptions: [],
  create: context => ({
    ImportDeclaration: (node: TSESTree.ImportDeclaration): void => {
      if (node.source.value === 'vscode') {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === AST_NODE_TYPES.ImportSpecifier &&
            specifier.imported.type === AST_NODE_TYPES.Identifier &&
            specifier.imported.name === 'Uri'
          ) {
            context.report({ node: specifier, messageId: 'useVscodeUri' });
          }
        }
      }
    },
    TSTypeReference: (node: TSESTree.TSTypeReference): void => {
      if (node.typeName.type === AST_NODE_TYPES.TSQualifiedName && isVscodeUriType(node.typeName)) {
        context.report({ node, messageId: 'useVscodeUri' });
      }
    },
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (isVscodeUriFileOrParse(node.callee)) {
        context.report({ node: node.callee, messageId: 'useVscodeUri' });
      }
    }
  })
});
