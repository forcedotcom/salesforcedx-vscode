/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { getParserServices, RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import type * as ts from 'typescript';

const effectTypeNames = new Set(['Effect', 'Stream', 'Schema']);

const fromEffectModule = (fileName: string, moduleName: string): boolean =>
  fileName.replaceAll('\\', '/').endsWith(`/effect/dist/dts/${moduleName}.d.ts`);

const isEffectPipe = (type: ts.Type): boolean =>
  type.getCallSignatures().some(signature => {
    const declaration = signature.getDeclaration();
    return declaration.name?.getText() === 'pipe' && fromEffectModule(declaration.getSourceFile().fileName, 'Function');
  });

const isEffectStreamOrSchema = (type: ts.Type): boolean => {
  const symbol = type.getSymbol() ?? type.aliasSymbol;
  const name = symbol?.getName();
  return (
    (name !== undefined &&
      effectTypeNames.has(name) &&
      (symbol?.getDeclarations()?.some(declaration => fromEffectModule(declaration.getSourceFile().fileName, name)) ??
        false)) ||
    // Schema.String and other Schema classes inherit `ast` from Schema.Schema.
    (type
      .getProperty('ast')
      ?.getDeclarations()
      ?.some(declaration => fromEffectModule(declaration.getSourceFile().fileName, 'Schema')) ??
      false)
  );
};

const isPipeableValue = (type: ts.Type): boolean =>
  type.getProperty('pipe') !== undefined &&
  (type.isUnion()
    ? type.types.length > 0 && type.types.every(isPipeableValue)
    : type.isIntersection()
      ? type.types.some(isEffectStreamOrSchema)
      : isEffectStreamOrSchema(type));

export const noStandalonePipeableValue = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use .pipe on an Effect, Stream, or Schema value instead of standalone pipe(value, ...).'
    },
    schema: [],
    messages: {
      useMethodPipe: 'This Effect, Stream, or Schema already has .pipe. Use its .pipe(...) method instead.'
    }
  },
  defaultOptions: [],
  create: context => {
    const services = getParserServices(context, true);
    if (services.program === null) return {};

    return {
      CallExpression: (node: TSESTree.CallExpression): void => {
        if (node.callee.type !== AST_NODE_TYPES.Identifier || node.arguments.length === 0) return;
        const value = node.arguments[0];
        if (value.type === AST_NODE_TYPES.SpreadElement) return;
        if (
          !isEffectPipe(services.getTypeAtLocation(node.callee)) ||
          !isPipeableValue(services.getTypeAtLocation(value))
        )
          return;
        context.report({ node, messageId: 'useMethodPipe' });
      }
    };
  }
});
