/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { getParserServices, RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import type * as ts from 'typescript';

/** `ts.TypeFlags` values. Numeric so this file can keep `import type` for `typescript`. */
const numberFlag = 64;
const numberLiteralFlag = 2048;
const undefinedFlag = 4;

const durationNames = new Set(['Duration', 'DurationInput']);

const isDurationSymbol = (symbol: ts.Symbol | undefined): boolean => {
  const fileName = symbol?.getDeclarations()?.[0]?.getSourceFile().fileName.replaceAll('\\', '/');
  const name = symbol?.getName();
  return (
    name !== undefined &&
    durationNames.has(name) &&
    fileName?.endsWith('/effect/dist/dts/Duration.d.ts') === true
  );
};

const mentionsDuration = (type: ts.Type, seen: ReadonlySet<ts.Type> = new Set()): boolean =>
  seen.has(type)
    ? false
    : isDurationSymbol(type.aliasSymbol) ||
      isDurationSymbol(type.getSymbol()) ||
      (type.isUnion() && type.types.some(part => mentionsDuration(part, new Set([...seen, type]))));

/** Plain `number` or `number | undefined`. A union that merely contains `number` stays flagged. */
const isPlainNumber = (type: ts.Type): boolean =>
  (type.flags & numberFlag) !== 0 ||
  (type.isUnion() &&
    type.types.some(part => (part.flags & numberFlag) !== 0) &&
    type.types.every(part => (part.flags & (numberFlag | undefinedFlag)) !== 0));

const isNumericValue = (type: ts.Type): boolean => (type.flags & (numberFlag | numberLiteralFlag)) !== 0;

const isObjectPropertyValue = (
  node: TSESTree.Property
): node is TSESTree.Property & { parent: TSESTree.ObjectExpression; value: TSESTree.Expression } =>
  node.parent.type === AST_NODE_TYPES.ObjectExpression;

const callArgs = (node: TSESTree.CallExpression): readonly TSESTree.Expression[] =>
  node.arguments.flatMap(arg => (arg.type === AST_NODE_TYPES.SpreadElement ? [] : [arg]));

export const noRawDuration = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow a raw number where the contextual type includes Duration or DurationInput. Wrap it with Duration.millis.'
    },
    schema: [],
    messages: {
      useMillis:
        'Bare number in a Duration or DurationInput position is milliseconds. Wrap it with Duration.millis.'
    }
  },
  defaultOptions: [],
  create: context => {
    const services = getParserServices(context, true);
    if (services.program === null) return {};

    const check = (node: TSESTree.Expression): void => {
      if (!isNumericValue(services.getTypeAtLocation(node))) return;
      const contextual = services.getContextualType(node);
      if (contextual === undefined || isPlainNumber(contextual) || !mentionsDuration(contextual)) return;
      context.report({ node, messageId: 'useMillis' });
    };

    return {
      CallExpression: (node: TSESTree.CallExpression): void => {
        callArgs(node).forEach(check);
      },
      Property: (node: TSESTree.Property): void => {
        if (!isObjectPropertyValue(node)) return;
        check(node.value);
      }
    };
  }
});
