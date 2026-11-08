/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { getParserServices, RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import type * as ts from 'typescript';

const isOption = (type: ts.Type): boolean => {
  const constraint = type.getConstraint();
  if (constraint && constraint !== type) return isOption(constraint);
  return type.isUnionOrIntersection()
    ? type.types.some(isOption)
    : (type
        .getProperty('_tag')
        ?.getDeclarations()
        ?.some(declaration => {
          const fileName = declaration.getSourceFile().fileName.replaceAll('\\', '/');
          return fileName.endsWith('/effect/dist/Option.d.ts') || fileName.endsWith('/effect/dist/dts/Option.d.ts');
        }) ?? false);
};

export const noOptionTag = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow direct reads of _tag on Effect Option values.'
    },
    schema: [],
    messages: {
      useOptionHelpers:
        'Do not read _tag on an Effect Option. Use Option.isNone or Option.isSome for case checks, or Option.match to handle both cases.'
    }
  },
  defaultOptions: [],
  create: context => {
    const services = getParserServices(context);

    const isTagKey = (key: TSESTree.Node, computed: boolean): boolean => {
      if (!computed) return key.type === AST_NODE_TYPES.Identifier && key.name === '_tag';
      const type = services.getTypeAtLocation(key);
      return type.isStringLiteral() && type.value === '_tag';
    };

    return {
      MemberExpression: (node: TSESTree.MemberExpression): void => {
        if (!isTagKey(node.property, node.computed)) return;
        if (
          (node.parent.type === AST_NODE_TYPES.AssignmentExpression &&
            node.parent.left === node &&
            node.parent.operator === '=') ||
          (node.parent.type === AST_NODE_TYPES.UnaryExpression && node.parent.operator === 'delete')
        )
          return;
        if (!isOption(services.getTypeAtLocation(node.object))) return;
        context.report({ node: node.property, messageId: 'useOptionHelpers' });
      },
      Property: (node: TSESTree.Property): void => {
        if (node.parent.type !== AST_NODE_TYPES.ObjectPattern || !isTagKey(node.key, node.computed)) return;
        const pattern = node.parent;
        const source =
          pattern.parent.type === AST_NODE_TYPES.AssignmentExpression && pattern.parent.left === pattern
            ? pattern.parent.right
            : pattern;
        if (!isOption(services.getTypeAtLocation(source))) return;
        context.report({ node: node.key, messageId: 'useOptionHelpers' });
      }
    };
  }
});
