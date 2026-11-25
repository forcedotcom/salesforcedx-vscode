/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import { sameReference } from './astUtils';
import { getNearestPackageJson } from './packageJsonUtils';

export const noDuplicateErrorMessageConversion = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: { description: 'Reuse shared error-message helpers instead of duplicating error-to-string conversions' },
    schema: [],
    messages: {
      useErrorMessageHelper: "Use {{helper}} from '{{packageName}}' instead of duplicating error-to-string conversion."
    }
  },
  defaultOptions: [],
  create: context => {
    // This file defines the conversion that other packages should reuse.
    if (
      context.physicalFilename
        .replaceAll('\\', '/')
        .endsWith('/packages/salesforcedx-utils/src/helpers/getErrorMessage.ts')
    ) {
      return {};
    }

    const packageJson = getNearestPackageJson(context.physicalFilename);
    const usesEffectExtUtils = [
      packageJson.dependencies,
      packageJson.devDependencies,
      packageJson.peerDependencies
    ].some(dependencies => dependencies?.['@salesforce/effect-ext-utils'] !== undefined);

    const isBuiltin =
      (name: string) =>
      (node: TSESTree.Node): boolean =>
        node.type === AST_NODE_TYPES.Identifier &&
        node.name === name &&
        !ASTUtils.findVariable(context.sourceCode.getScope(node), node)?.defs.length;

    return {
      ConditionalExpression: (node: TSESTree.ConditionalExpression): void => {
        const test = node.test;
        const value =
          test.type === AST_NODE_TYPES.CallExpression &&
          !test.optional &&
          test.arguments.length === 1 &&
          test.callee.type === AST_NODE_TYPES.Identifier &&
          test.callee.name === 'isError'
            ? test.arguments[0]
            : test.type === AST_NODE_TYPES.BinaryExpression &&
                test.operator === 'instanceof' &&
                isBuiltin('Error')(test.right)
              ? test.left
              : undefined;
        // Property reads can invoke getters or proxy traps each time they are evaluated.
        if (value?.type !== AST_NODE_TYPES.Identifier) return;

        const { consequent, alternate } = node;
        if (
          consequent.type !== AST_NODE_TYPES.MemberExpression ||
          consequent.computed ||
          consequent.optional ||
          consequent.property.type !== AST_NODE_TYPES.Identifier ||
          consequent.property.name !== 'message' ||
          !sameReference(value, consequent.object) ||
          alternate.type !== AST_NODE_TYPES.CallExpression ||
          alternate.optional ||
          !isBuiltin('String')(alternate.callee) ||
          alternate.arguments.length !== 1 ||
          !sameReference(value, alternate.arguments[0])
        ) {
          return;
        }

        context.report({
          node,
          messageId: 'useErrorMessageHelper',
          data: {
            helper: usesEffectExtUtils ? 'getMessageFromError' : 'getErrorMessage',
            packageName: usesEffectExtUtils ? '@salesforce/effect-ext-utils' : '@salesforce/salesforcedx-utils'
          }
        });
      }
    };
  }
});
