/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { getParserServices, RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import type * as ts from 'typescript';

const leafCount = (expression: TSESTree.Expression): number =>
  expression.type === AST_NODE_TYPES.ConditionalExpression
    ? leafCount(expression.consequent) + leafCount(expression.alternate)
    : 1;

const effectDeclaration = (symbol: ts.Symbol | undefined): boolean => {
  const fileName = symbol?.getDeclarations()?.[0]?.getSourceFile().fileName.replaceAll('\\', '/');
  return (
    symbol?.getName() === 'Effect' &&
    fileName !== undefined &&
    fileName.includes('/node_modules/effect/') &&
    (fileName.endsWith('/Effect.d.ts') || fileName.endsWith('/Effect.ts'))
  );
};

const isEffectType = (type: ts.Type): boolean =>
  type.isUnion()
    ? type.types.length > 0 && type.types.every(isEffectType)
    : type.isIntersection()
      ? type.types.some(isEffectType)
      : effectDeclaration(type.getSymbol()) || effectDeclaration(type.aliasSymbol);

const isDirectBranch = (node: TSESTree.ConditionalExpression): boolean => {
  const parent = node.parent;
  return (
    parent.type === AST_NODE_TYPES.ConditionalExpression &&
    (parent.consequent === node || parent.alternate === node)
  );
};

export const noNestedEffectTernary = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow nested ternaries that choose an Effect. Use Match.value / Match.when / Match.orElse instead.'
    },
    schema: [],
    messages: {
      useMatch:
        'Nested ternaries that choose an Effect should use Match.value / Match.when / Match.orElse. Use Match.orElse(() => Effect.void) for a no-op branch.'
    }
  },
  defaultOptions: [],
  create: context => {
    const services = getParserServices(context, true);
    if (services.program === null) return {};

    const effectDispatch = (node: TSESTree.ConditionalExpression): boolean =>
      leafCount(node) >= 3 && isEffectType(services.getTypeAtLocation(node));

    const coveredByEffectParent = (node: TSESTree.ConditionalExpression): boolean =>
      isDirectBranch(node) &&
      node.parent.type === AST_NODE_TYPES.ConditionalExpression &&
      effectDispatch(node.parent);

    return {
      ConditionalExpression: (node: TSESTree.ConditionalExpression): void => {
        if (!effectDispatch(node) || coveredByEffectParent(node)) return;
        context.report({ node, messageId: 'useMatch' });
      }
    };
  }
});
