/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

type EffectServiceContext = {
  effectBody: TSESTree.BlockStatement;
  dependencyNames: Set<string>;
  yieldedServiceVarNames: Set<string>;
};

const isEffectServiceCall = (node: TSESTree.CallExpression): boolean => {
  const callee = node.callee;
  const inner = callee.type === AST_NODE_TYPES.CallExpression ? callee.callee : callee;
  if (inner.type !== AST_NODE_TYPES.MemberExpression) return false;
  const obj = inner.object;
  const prop = inner.property;
  return (
    obj.type === AST_NODE_TYPES.Identifier &&
    obj.name === 'Effect' &&
    prop.type === AST_NODE_TYPES.Identifier &&
    prop.name === 'Service'
  );
};

const getDependencyNames = (depsNode: TSESTree.ArrayExpression | undefined): Set<string> => {
  const names = new Set<string>();
  if (!depsNode) return names;
  for (const el of depsNode.elements) {
    if (el?.type === AST_NODE_TYPES.MemberExpression && el.property.type === AST_NODE_TYPES.Identifier) {
      if (el.property.name === 'Default' && el.object.type === AST_NODE_TYPES.Identifier) {
        names.add(el.object.name);
      }
    }
  }
  return names;
};

const getEffectGenBody = (effectNode: TSESTree.Node | undefined): TSESTree.BlockStatement | undefined => {
  if (effectNode?.type !== AST_NODE_TYPES.CallExpression) return undefined;
  const callee = effectNode.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
  if (
    callee.property.type !== AST_NODE_TYPES.Identifier ||
    callee.property.name !== 'gen'
  )
    return undefined;
  const arg = effectNode.arguments[0];
  if (arg?.type !== AST_NODE_TYPES.FunctionExpression) return undefined;
  if (!arg.generator) return undefined;
  return arg.body;
};

const findEffectServiceContexts = (node: TSESTree.Node): EffectServiceContext[] => {
  const contexts: EffectServiceContext[] = [];
  if (node.type !== AST_NODE_TYPES.ClassDeclaration) return contexts;
  const ext = (node as TSESTree.ClassDeclaration).superClass;
  if (ext?.type !== AST_NODE_TYPES.CallExpression || (ext.arguments?.length ?? 0) < 2) return contexts;
  const config = ext.arguments[1];
  if (config?.type !== AST_NODE_TYPES.ObjectExpression) return contexts;
  const configObj = config;
  const depsProp = configObj.properties.find(
    (p: TSESTree.ObjectLiteralElement): p is TSESTree.Property =>
      p.type === AST_NODE_TYPES.Property &&
      p.key.type === AST_NODE_TYPES.Identifier &&
      p.key.name === 'dependencies'
  );
  const effectProp = configObj.properties.find(
    (p: TSESTree.ObjectLiteralElement): p is TSESTree.Property =>
      p.type === AST_NODE_TYPES.Property &&
      p.key.type === AST_NODE_TYPES.Identifier &&
      p.key.name === 'effect'
  );
  const depsValue = depsProp?.value;
  const effectValue = effectProp?.value;
  if (depsValue?.type !== AST_NODE_TYPES.ArrayExpression) return contexts;
  const dependencyNames = getDependencyNames(depsValue);
  if (dependencyNames.size === 0) return contexts;
  const effectBody = getEffectGenBody(effectValue);
  if (!effectBody) return contexts;
  const callee = ext.callee;
  if (callee.type !== AST_NODE_TYPES.CallExpression || !isEffectServiceCall(callee)) return contexts;
  const yieldedServiceVarNames = getYieldedServiceVarNames(effectBody, dependencyNames);
  contexts.push({ effectBody, dependencyNames, yieldedServiceVarNames });
  return contexts;
};

const isDescendantOf = (node: TSESTree.Node, ancestor: TSESTree.Node): boolean => {
  let current: TSESTree.Node | undefined = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
};

/** Effect.fn('name')(function* (...) { ... }) - the generator is the callback */
const isInsideEffectFn = (node: TSESTree.Node, effectBody: TSESTree.BlockStatement): boolean => {
  if (!isDescendantOf(node, effectBody)) return false;
  let current: TSESTree.Node | undefined = node;
  while (current && current !== effectBody) {
    if (current.type === AST_NODE_TYPES.FunctionExpression && current.generator) {
      const parent: TSESTree.Node | undefined = current.parent;
      if (parent?.type === AST_NODE_TYPES.CallExpression && parent.arguments[0] === current) {
        const callee = parent.callee;
        if (callee.type === AST_NODE_TYPES.CallExpression) {
          const inner = callee.callee;
          if (
            inner.type === AST_NODE_TYPES.MemberExpression &&
            inner.object.type === AST_NODE_TYPES.Identifier &&
            inner.object.name === 'Effect' &&
            inner.property.type === AST_NODE_TYPES.Identifier &&
            inner.property.name === 'fn'
          ) {
            return true;
          }
        }
      }
    }
    current = current.parent;
  }
  return false;
};

const getYieldedServiceVarNames = (
  effectBody: TSESTree.BlockStatement,
  dependencyNames: Set<string>
): Set<string> => {
  const names = new Set<string>();
  for (const stmt of effectBody.body) {
    if (stmt.type === AST_NODE_TYPES.VariableDeclaration) {
      for (const decl of stmt.declarations) {
        if (decl.id.type === AST_NODE_TYPES.Identifier) {
          const init = decl.init;
          if (
            init?.type === AST_NODE_TYPES.YieldExpression &&
            init.delegate &&
            init.argument?.type === AST_NODE_TYPES.Identifier &&
            dependencyNames.has(init.argument.name)
          ) {
            names.add(decl.id.name);
          }
        }
      }
    }
  }
  return names;
};

export const noEffectServiceAccessorCalls = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'When a service with accessors is a dependency, yield the service and call accessors only inside Effect.fn callbacks. Top-level accessor calls run during layer building.'
    },
    schema: [],
    messages: {
      useYieldedService:
        'Do not call {{serviceName}}.{{methodName}}() when it is a dependency. Yield the service first: `const s = yield* {{serviceName}};` then use `s.{{methodName}}()` inside Effect.fn.',
      accessorMustBeInEffectFn:
        'Accessor call {{varName}}.{{methodName}}() must be inside an Effect.fn callback. Top-level calls run during layer building.'
    }
  },
  defaultOptions: [],
  create: context => {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const ast = sourceCode.ast;
    const contexts = ast.body.flatMap(n => findEffectServiceContexts(n));
    if (contexts.length === 0) return {};

    return {
      CallExpression: (node: TSESTree.CallExpression): void => {
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
        const obj = callee.object;
        const prop = callee.property;
        if (obj.type !== AST_NODE_TYPES.Identifier || prop.type !== AST_NODE_TYPES.Identifier)
          return;
        const serviceName = obj.name;
        const methodName = prop.name;
        if (methodName === 'Default') return;
        const ctx = contexts.find(c => isDescendantOf(node, c.effectBody));
        if (!ctx) return;
        const inEffectFn = isInsideEffectFn(node, ctx.effectBody);
        if (ctx.dependencyNames.has(serviceName)) {
          context.report({
            node: callee,
            messageId: 'useYieldedService',
            data: { serviceName, methodName }
          });
          return;
        }
        if (ctx.yieldedServiceVarNames.has(serviceName) && !inEffectFn) {
          context.report({
            node: callee,
            messageId: 'accessorMustBeInEffectFn',
            data: { varName: serviceName, methodName }
          });
        }
      }
    };
  }
});
