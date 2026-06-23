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

type TapMatch = { call: TSESTree.CallExpression; arrow: TSESTree.ArrowFunctionExpression };

/** `Effect.tap(arg => <annotate call>)` — returns the validated arrow and the annotate call inside it */
const annotateFromTapCall = (node: TSESTree.CallExpressionArgument): TapMatch | undefined => {
  if (node.type !== AST_NODE_TYPES.CallExpression) return undefined;
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
  const { object, property } = callee;
  if (object.type !== AST_NODE_TYPES.Identifier || object.name !== 'Effect') return undefined;
  if (property.type !== AST_NODE_TYPES.Identifier || property.name !== 'tap') return undefined;
  const arrow = node.arguments[0];
  if (arrow?.type !== AST_NODE_TYPES.ArrowFunctionExpression) return undefined;
  const body = arrow.body;
  return body.type === AST_NODE_TYPES.CallExpression && isAnnotateCurrentSpanCall(body)
    ? { call: body, arrow }
    : undefined;
};

/** Every Identifier name referenced anywhere under `node` */
const referencedIdentifiers = (node: TSESTree.Node): Set<string> => {
  const names = new Set<string>();
  const isNode = (value: unknown): value is TSESTree.Node =>
    Boolean(value) && typeof value === 'object' && 'type' in (value as object);
  const visit = (n: TSESTree.Node): void => {
    if (n.type === AST_NODE_TYPES.Identifier) names.add(n.name);
    Object.entries(n)
      .filter(([prop]) => prop !== 'parent')
      .flatMap(([, value]): unknown[] => (Array.isArray(value) ? (value as unknown[]) : [value]))
      .filter(isNode)
      .forEach(visit);
  };
  visit(node);
  return names;
};

/** Param identifier names declared by an arrow */
const arrowParamNames = (arrow: TSESTree.ArrowFunctionExpression): string[] =>
  arrow.params.filter((p): p is TSESTree.Identifier => p.type === AST_NODE_TYPES.Identifier).map(p => p.name);

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
  // last index per literal key (later wins); a key whose recorded last index differs is an earlier dup occurrence
  const lastIndex = props.reduce<Record<string, number>>(
    (acc, p, i) => (p.key === undefined ? acc : { ...acc, [p.key]: i }),
    {}
  );
  const hasDup = props.some((p, i) => p.key !== undefined && lastIndex[p.key] !== i);
  const kept = props.filter((p, i) => p.key === undefined || lastIndex[p.key] === i);
  return { text: `{ ${kept.map(p => p.text).join(', ')} }`, hasDup };
};

type Run<Match> = { matches: Match[]; from: TSESTree.Node; to: TSESTree.Node };

/** Group `items` into runs of ≥2 consecutive elements that `match`, each paired with the source node spanning it */
const findRuns = <Item, Match>(
  items: readonly Item[],
  nodeOf: (item: Item) => TSESTree.Node,
  match: (item: Item) => Match | undefined
): Run<Match>[] => {
  type Entry = { item: Item; match: Match };
  const toRun = (entries: Entry[]): Run<Match> => ({
    matches: entries.map(e => e.match),
    from: nodeOf(entries[0].item),
    to: nodeOf(entries.at(-1)!.item)
  });
  const final = items.reduce<{ runs: Run<Match>[]; current: Entry[] }>(
    (acc, item) => {
      const m = match(item);
      if (m !== undefined) return { runs: acc.runs, current: [...acc.current, { item, match: m }] };
      const flushed = acc.current.length >= 2 ? [...acc.runs, toRun(acc.current)] : acc.runs;
      return { runs: flushed, current: [] };
    },
    { runs: [], current: [] }
  );
  return final.current.length >= 2 ? [...final.runs, toRun(final.current)] : final.runs;
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
      // a comment between the merged calls would be silently deleted by the range replace — report without autofix
      const hasInterleavedComment = sourceCode
        .getCommentsInside(fromNode.parent ?? fromNode)
        .some(c => c.range[0] > fromNode.range[0] && c.range[1] < toNode.range[1]);
      context.report({
        node: fromNode,
        messageId: merged.hasDup ? 'duplicateKey' : 'successiveAnnotate',
        ...(hasInterleavedComment
          ? {}
          : {
              fix: (fixer: TSESLint.RuleFixer) =>
                fixer.replaceTextRange(
                  [fromNode.range[0], toNode.range[1]],
                  wrap(`Effect.annotateCurrentSpan(${merged.text})`)
                )
            })
      });
    };

    return {
      // generator form: consecutive `yield* Effect.annotateCurrentSpan(...)` statements
      BlockStatement: (block: TSESTree.BlockStatement): void => {
        findRuns(
          block.body,
          stmt => stmt,
          stmt => annotateFromYieldStatement(stmt)
        ).forEach(run => reportRun(run.matches, run.from, run.to, merged => `yield* ${merged};`));
      },

      // tap-chain form: consecutive Effect.tap(x => annotate) args in a pipe call
      CallExpression: (node: TSESTree.CallExpression): void => {
        findRuns(
          node.arguments,
          arg => arg,
          arg => annotateFromTapCall(arg)
        )
          // skip runs where a non-first tap references its own arrow param — merging into the
          // first tap's single param would leave that reference undeclared (see W-23138529 review)
          .filter(run =>
            run.matches.slice(1).every(({ call, arrow }) => {
              const referenced = referencedIdentifiers(call);
              return arrowParamNames(arrow).every(name => !referenced.has(name));
            })
          )
          .forEach(run => {
            const firstArrow = run.matches[0].arrow;
            const paramText =
              firstArrow.params.length === 0 ? '()' : firstArrow.params.map(p => sourceCode.getText(p)).join(', ');
            reportRun(
              run.matches.map(m => m.call),
              run.from,
              run.to,
              merged => `Effect.tap(${paramText} => ${merged})`
            );
          });
      }
    };
  }
});
