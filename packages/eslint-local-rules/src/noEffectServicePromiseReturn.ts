/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { getParserServices, RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import type * as ts from 'typescript';

type FunctionNode = TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

type PromiseMethod = {
  methodName: string;
  node: TSESTree.Node;
};

type TypeInfo = {
  checker: ts.TypeChecker;
  getTypeAtLocation: (node: TSESTree.Node) => ts.Type;
  getTypeOfSymbolAtLocation: (symbol: ts.Symbol, node: TSESTree.Node) => ts.Type;
};

const serviceConstructorNames = new Set(['gen', 'sync', 'fn']);

const isFunctionNode = (node: TSESTree.Node | undefined): node is FunctionNode =>
  node?.type === AST_NODE_TYPES.FunctionExpression || node?.type === AST_NODE_TYPES.ArrowFunctionExpression;

const isIdentifierNamed = (node: TSESTree.Node, name: string): boolean =>
  node.type === AST_NODE_TYPES.Identifier && node.name === name;

/** `Effect.Service<…>()` / `Effect.Service()`, same shape as noEffectServiceAccessorCalls. */
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

const effectCalleeName = (node: TSESTree.CallExpression): string | undefined => {
  const callee = node.callee.type === AST_NODE_TYPES.CallExpression ? node.callee.callee : node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
  if (!isIdentifierNamed(callee.object, 'Effect') || callee.property.type !== AST_NODE_TYPES.Identifier) return undefined;
  return callee.property.name;
};

const isServiceConfig = (node: TSESTree.ObjectExpression): boolean => {
  const call = node.parent;
  if (call?.type !== AST_NODE_TYPES.CallExpression || call.arguments[1] !== node) return false;
  const callee = call.callee;
  return callee.type === AST_NODE_TYPES.CallExpression && isEffectServiceCall(callee);
};

const isEffectOrScopedKey = (node: TSESTree.Property): boolean =>
  !node.computed && (isIdentifierNamed(node.key, 'effect') || isIdentifierNamed(node.key, 'scoped'));

const isEffectOrScopedProperty = (node: TSESTree.Node | undefined): node is TSESTree.Property =>
  node?.type === AST_NODE_TYPES.Property &&
  isEffectOrScopedKey(node) &&
  node.parent?.type === AST_NODE_TYPES.ObjectExpression &&
  isServiceConfig(node.parent);

const pipedRoot = (node: TSESTree.Node): TSESTree.Node => {
  const parent = node.parent;
  return parent?.type === AST_NODE_TYPES.MemberExpression &&
    parent.object === node &&
    isIdentifierNamed(parent.property, 'pipe') &&
    parent.parent?.type === AST_NODE_TYPES.CallExpression &&
    parent.parent.callee === parent
    ? pipedRoot(parent.parent)
    : node;
};

const nearestFunction = (node: TSESTree.Node): FunctionNode | undefined => {
  const parent = node.parent;
  if (!parent) return undefined;
  return isFunctionNode(parent) ? parent : nearestFunction(parent);
};

const isFactory = (fn: FunctionNode): boolean => isEffectOrScopedProperty(fn.parent) && fn.parent.value === fn;

/** After `.pipe` unwrap: `effect`/`scoped` property value, or body/return of a factory that is that value. */
const isServiceEffectRoot = (call: TSESTree.CallExpression): boolean => {
  const rooted = pipedRoot(call);
  const parent = rooted.parent;
  if (!parent) return false;
  if (isEffectOrScopedProperty(parent) && parent.value === rooted) return true;
  if (isFunctionNode(parent) && parent.body === rooted && isFactory(parent)) return true;
  if (parent.type !== AST_NODE_TYPES.ReturnStatement || parent.argument !== rooted) return false;
  const fn = nearestFunction(parent);
  return fn !== undefined && isFactory(fn);
};

const isServiceCallback = (fn: FunctionNode): boolean => {
  const parent = fn.parent;
  if (parent?.type !== AST_NODE_TYPES.CallExpression || !parent.arguments.includes(fn)) return false;
  const name = effectCalleeName(parent);
  return name !== undefined && serviceConstructorNames.has(name) && isServiceEffectRoot(parent);
};

const isServiceSucceed = (node: TSESTree.CallExpression): boolean =>
  effectCalleeName(node) === 'succeed' && isServiceEffectRoot(node);

const unwrapExpr = (node: TSESTree.Expression): TSESTree.Expression =>
  node.type === AST_NODE_TYPES.TSAsExpression ||
  node.type === AST_NODE_TYPES.TSSatisfiesExpression ||
  node.type === AST_NODE_TYPES.TSTypeAssertion ||
  node.type === AST_NODE_TYPES.TSNonNullExpression
    ? unwrapExpr(node.expression)
    : node;

const propertyName = (prop: TSESTree.Property): string =>
  !prop.computed && prop.key.type === AST_NODE_TYPES.Identifier
    ? prop.key.name
    : prop.key.type === AST_NODE_TYPES.Literal && typeof prop.key.value === 'string'
      ? prop.key.value
      : 'method';

const declaredInTypeScriptLib = (symbol: ts.Symbol): boolean => {
  const declarations = symbol.getDeclarations();
  return (
    declarations !== undefined &&
    declarations.length > 0 &&
    declarations.every(declaration =>
      declaration.getSourceFile().fileName.replaceAll('\\', '/').includes('/typescript/lib/lib.')
    )
  );
};

const namedPromise = (symbol: ts.Symbol | undefined): boolean =>
  symbol?.getName() === 'Promise' &&
  (symbol.getDeclarations()?.some(declaration =>
    declaration.getSourceFile().fileName.replaceAll('\\', '/').includes('/typescript/lib/lib.')
  ) ??
    false);

const isPromiseType = (type: ts.Type, checker: ts.TypeChecker): boolean => {
  if (type.isUnion() || type.isIntersection()) return type.types.some(part => isPromiseType(part, checker));
  const apparent = checker.getApparentType(type);
  return namedPromise(type.getSymbol() ?? type.aliasSymbol ?? apparent.getSymbol());
};

const callSignatures = (type: ts.Type): readonly ts.Signature[] =>
  type.isUnion() ? type.types.flatMap(callSignatures) : type.getCallSignatures();

const returnsPromise = (type: ts.Type, checker: ts.TypeChecker): boolean =>
  callSignatures(type).some(signature => isPromiseType(signature.getReturnType(), checker));

const methodsFromType = (node: TSESTree.Node, types: TypeInfo): PromiseMethod[] => {
  const type = types.getTypeAtLocation(node);
  if (isPromiseType(type, types.checker)) return [];
  return type.getProperties().flatMap(symbol =>
    declaredInTypeScriptLib(symbol) || !returnsPromise(types.getTypeOfSymbolAtLocation(symbol, node), types.checker)
      ? []
      : [{ methodName: symbol.getName(), node }]
  );
};

const promiseMethods = (expression: TSESTree.Expression, types: TypeInfo): PromiseMethod[] => {
  const node = unwrapExpr(expression);
  return node.type === AST_NODE_TYPES.ObjectExpression
    ? node.properties.flatMap(prop =>
        prop.type === AST_NODE_TYPES.SpreadElement
          ? promiseMethods(prop.argument, types)
          : prop.type === AST_NODE_TYPES.Property && returnsPromise(types.getTypeAtLocation(prop.value), types.checker)
            ? [{ methodName: propertyName(prop), node: prop }]
            : []
      )
    : methodsFromType(node, types);
};

export const noEffectServicePromiseReturn = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Effect.Service methods that return Promise. Service methods must return Effect.'
    },
    schema: [],
    messages: {
      promiseReturn:
        'Effect.Service method {{methodName}} returns Promise. Return an Effect instead, for example Effect.fn.'
    }
  },
  defaultOptions: [],
  create: context => {
    const services = getParserServices(context, true);
    if (services.program === null) return {};

    const types: TypeInfo = {
      checker: services.program.getTypeChecker(),
      getTypeAtLocation: node => services.getTypeAtLocation(node),
      getTypeOfSymbolAtLocation: (symbol, node) => services.getTypeOfSymbolAtLocation(symbol, node)
    };

    const reportShape = (expression: TSESTree.Expression): void => {
      promiseMethods(expression, types).forEach(method => {
        context.report({ node: method.node, messageId: 'promiseReturn', data: { methodName: method.methodName } });
      });
    };

    const onCallback = (node: FunctionNode): void => {
      if (!isServiceCallback(node) || node.body.type === AST_NODE_TYPES.BlockStatement) return;
      reportShape(node.body);
    };

    return {
      FunctionExpression: onCallback,
      ArrowFunctionExpression: onCallback,
      ReturnStatement: (node: TSESTree.ReturnStatement): void => {
        if (!node.argument) return;
        const fn = nearestFunction(node);
        if (!fn || !isServiceCallback(fn)) return;
        reportShape(node.argument);
      },
      CallExpression: (node: TSESTree.CallExpression): void => {
        if (!isServiceSucceed(node)) return;
        const arg = node.arguments[0];
        if (!arg || arg.type === AST_NODE_TYPES.SpreadElement) return;
        reportShape(arg);
      }
    };
  }
});
