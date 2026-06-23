/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

/** Effect.annotateCurrentSpan(...) member call */
const isAnnotateCurrentSpanCall = (
  node: TSESTree.Expression | TSESTree.PrivateIdentifier
): node is TSESTree.CallExpression => {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const { object, property } = callee;
  return (
    object.type === AST_NODE_TYPES.Identifier &&
    object.name === 'Effect' &&
    property.type === AST_NODE_TYPES.Identifier &&
    property.name === 'annotateCurrentSpan'
  );
};

/** `yield* <annotate call>` expression statement */
const annotateFromYieldStatement = (stmt: TSESTree.Statement): TSESTree.CallExpression | undefined => {
  if (stmt.type !== AST_NODE_TYPES.ExpressionStatement) return undefined;
  const expr = stmt.expression;
  if (expr.type !== AST_NODE_TYPES.YieldExpression || !expr.delegate || !expr.argument) return undefined;
  return isAnnotateCurrentSpanCall(expr.argument) ? expr.argument : undefined;
};

/** `Effect.tap(arg => <annotate call>)` — returns the annotate call inside the arrow */
const annotateFromTapCall = (node: TSESTree.CallExpressionArgument): TSESTree.CallExpression | undefined => {
  if (node.type !== AST_NODE_TYPES.CallExpression) return undefined;
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
  const { object, property } = callee;
  if (object.type !== AST_NODE_TYPES.Identifier || object.name !== 'Effect') return undefined;
  if (property.type !== AST_NODE_TYPES.Identifier || property.name !== 'tap') return undefined;
  const arrow = node.arguments[0];
  if (arrow?.type !== AST_NODE_TYPES.ArrowFunctionExpression) return undefined;
  const body = arrow.body;
  return body.type === AST_NODE_TYPES.CallExpression && isAnnotateCurrentSpanCall(body) ? body : undefined;
};

type MergedProp = { text: string; key: string | undefined };

/** Convert one annotate call's args into object-property source texts (literal key dedup tracked via `key`) */
const propsFromAnnotateCall = (call: TSESTree.CallExpression, sourceCode: TSESLint.SourceCode): MergedProp[] => {
  const [first, second] = call.arguments;
  // 1-arg object → spread its props
  if (call.arguments.length === 1 && first.type === AST_NODE_TYPES.ObjectExpression) {
    return first.properties.map(prop => ({
      text: sourceCode.getText(prop),
      key:
        prop.type === AST_NODE_TYPES.Property && !prop.computed && prop.key.type === AST_NODE_TYPES.Identifier
          ? prop.key.name
          : prop.type === AST_NODE_TYPES.Property && prop.key.type === AST_NODE_TYPES.Literal
            ? String(prop.key.value)
            : undefined
    }));
  }
  // 1-arg non-object → spread the expression
  if (call.arguments.length === 1) {
    return [{ text: `...${sourceCode.getText(first)}`, key: undefined }];
  }
  // 2-arg (key, value)
  const valueText = sourceCode.getText(second);
  if (first.type === AST_NODE_TYPES.Literal && typeof first.value === 'string') {
    // string-literal key → ident if valid, else quoted
    const isIdent = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(first.value);
    const keyText = isIdent ? first.value : sourceCode.getText(first);
    // shorthand when value text equals key ident
    const propText = isIdent && valueText === first.value ? first.value : `${keyText}: ${valueText}`;
    return [{ text: propText, key: first.value }];
  }
  // non-literal key → computed
  const computedKeyText = sourceCode.getText(first);
  return [{ text: `[${computedKeyText}]: ${valueText}`, key: undefined }];
};

/** Build merged object source `{ ...props }`, keeping last value for duplicate literal keys */
const buildMergedObject = (props: MergedProp[]): { text: string; hasDup: boolean } => {
  const seen = new Set<string>();
  let hasDup = false;
  // detect dups first
  props.forEach(p => {
    if (p.key !== undefined) {
      if (seen.has(p.key)) hasDup = true;
      seen.add(p.key);
    }
  });
  // keep last occurrence per literal key
  const lastIndex = new Map<string, number>();
  props.forEach((p, i) => {
    if (p.key !== undefined) lastIndex.set(p.key, i);
  });
  const kept = props.filter((p, i) => p.key === undefined || lastIndex.get(p.key) === i);
  return { text: `{ ${kept.map(p => p.text).join(', ')} }`, hasDup };
};

export const noSuccessiveAnnotateCurrentSpan = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Merge successive Effect.annotateCurrentSpan calls into a single call'
    },
    fixable: 'code',
    schema: [],
    messages: {
      successiveAnnotate:
        'Successive Effect.annotateCurrentSpan calls should be merged into a single Effect.annotateCurrentSpan({ ... }) call.',
      duplicateKey:
        'Successive Effect.annotateCurrentSpan calls set the same key more than once. Merge into a single call (last value wins).'
    }
  },
  defaultOptions: [],
  create: context => {
    const sourceCode = context.sourceCode;

    /** Report+fix a run of ≥2 annotate calls spanning fromNode..toNode, using merged props */
    const reportRun = (
      annotateCalls: TSESTree.CallExpression[],
      fromNode: TSESTree.Node,
      toNode: TSESTree.Node,
      wrap: (mergedObject: string) => string
    ): void => {
      const props = annotateCalls.flatMap(call => propsFromAnnotateCall(call, sourceCode));
      const merged = buildMergedObject(props);
      context.report({
        node: fromNode,
        messageId: merged.hasDup ? 'duplicateKey' : 'successiveAnnotate',
        fix: fixer =>
          fixer.replaceTextRange(
            [fromNode.range[0], toNode.range[1]],
            wrap(`Effect.annotateCurrentSpan(${merged.text})`)
          )
      });
    };

    return {
      // generator form: consecutive `yield* Effect.annotateCurrentSpan(...)` statements
      BlockStatement: (block: TSESTree.BlockStatement): void => {
        const body = block.body;
        let i = 0;
        while (i < body.length) {
          const first = annotateFromYieldStatement(body[i]);
          if (!first) {
            i += 1;
            continue;
          }
          const run: TSESTree.CallExpression[] = [first];
          let j = i + 1;
          while (j < body.length) {
            const next = annotateFromYieldStatement(body[j]);
            if (!next) break;
            run.push(next);
            j += 1;
          }
          if (run.length >= 2) {
            reportRun(run, body[i], body[j - 1], merged => `yield* ${merged};`);
          }
          i = j > i + 1 ? j : i + 1;
        }
      },

      // tap-chain form: consecutive Effect.tap(x => annotate) args in a pipe call
      CallExpression: (node: TSESTree.CallExpression): void => {
        const args = node.arguments;
        let i = 0;
        while (i < args.length) {
          const first = annotateFromTapCall(args[i]);
          if (!first) {
            i += 1;
            continue;
          }
          const run: TSESTree.CallExpression[] = [first];
          const tapArgs: TSESTree.CallExpressionArgument[] = [args[i]];
          let j = i + 1;
          while (j < args.length) {
            const next = annotateFromTapCall(args[j]);
            if (!next) break;
            run.push(next);
            tapArgs.push(args[j]);
            j += 1;
          }
          if (run.length >= 2) {
            const tapArrow = (args[i] as TSESTree.CallExpression).arguments[0] as TSESTree.ArrowFunctionExpression;
            const paramText = tapArrow.params.map(p => sourceCode.getText(p)).join(', ');
            reportRun(run, tapArgs[0], tapArgs.at(-1)!, merged => `Effect.tap(${paramText} => ${merged})`);
          }
          i = j > i + 1 ? j : i + 1;
        }
      }
    };
  }
});
