/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const isEffectFnCall = (node: TSESTree.CallExpression): TSESTree.FunctionExpression | undefined => {
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.CallExpression) return undefined;

  const innerCallee = callee.callee;
  if (innerCallee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
  const obj = innerCallee.object;
  const prop = innerCallee.property;
  if (obj.type !== AST_NODE_TYPES.Identifier || obj.name !== 'Effect') return undefined;
  if (prop.type !== AST_NODE_TYPES.Identifier || prop.name !== 'fn') return undefined;

  const gen = node.arguments[0];
  if (!gen || gen.type !== AST_NODE_TYPES.FunctionExpression) return undefined;
  if (!gen.generator) return undefined;

  return gen;
};

const getBodyExpression = (
  body: TSESTree.ArrowFunctionExpression['body']
): TSESTree.CallExpression | undefined => {
  if (body.type === AST_NODE_TYPES.CallExpression) return body;
  if (body.type === AST_NODE_TYPES.BlockStatement) {
    const stmt = body.body[0];
    if (stmt?.type === AST_NODE_TYPES.ReturnStatement && stmt.argument) {
      return stmt.argument.type === AST_NODE_TYPES.CallExpression ? stmt.argument : undefined;
    }
    return undefined;
  }
  return undefined;
};

const unwrapInvokedEffectFn = (
  node: TSESTree.CallExpression
): { effectFnCall: TSESTree.CallExpression; trailingInvoke: boolean } | undefined => {
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.CallExpression) return undefined;
  const gen = isEffectFnCall(callee);
  return gen !== undefined ? { effectFnCall: callee, trailingInvoke: true } : undefined;
};

export const noEffectFnWrapper = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Define Effect.fn directly; do not wrap it in an arrow function'
    },
    fixable: 'code',
    schema: [],
    messages: {
      noEffectFnWrapper:
        'Define Effect.fn directly instead of a JS function that returns it: Effect.fn("name")(function* (params) {})'
    }
  },
  defaultOptions: [],
  create: context => ({
      ArrowFunctionExpression: (node: TSESTree.ArrowFunctionExpression): void => {
        const bodyExpr = getBodyExpression(node.body);
        if (!bodyExpr) return;

        let effectFnCall: TSESTree.CallExpression;
        let trailingInvoke = false;

        const innerGen = isEffectFnCall(bodyExpr);
        if (innerGen !== undefined) {
          effectFnCall = bodyExpr;
        } else {
          const unwrapped = unwrapInvokedEffectFn(bodyExpr);
          if (!unwrapped) return;
          effectFnCall = unwrapped.effectFnCall;
          trailingInvoke = unwrapped.trailingInvoke;
        }

        const gen = isEffectFnCall(effectFnCall);
        if (!gen) return;

        const sourceCode = context.sourceCode ?? context.getSourceCode();

        context.report({
          node,
          messageId: 'noEffectFnWrapper',
          fix: fixer => {
            const effectFnInner = effectFnCall.callee as TSESTree.CallExpression;
            const fnName = sourceCode.getText(effectFnInner.arguments[0]);
            const genText = sourceCode.getText(gen);
            const genBodyMatch = genText.match(/function\*\s*\([^)]*\)\s*\{([\s\S]*)\}/);
            const genBody = genBodyMatch ? genBodyMatch[1] : genText.slice(genText.indexOf('{') + 1, -1);
            const paramsText =
              node.params.length > 0
                ? node.params.map(p => sourceCode.getText(p)).join(', ')
                : gen.params.map(p => sourceCode.getText(p)).join(', ');
            const newGen = `function* (${paramsText}) {${genBody}}`;
            const newEffectFnCall = `Effect.fn(${fnName})(${newGen})`;
            const suffix = trailingInvoke ? '()' : '';
            return fixer.replaceTextRange(node.range, `${newEffectFnCall}${suffix}`);
          }
        });
      }
    })
});
