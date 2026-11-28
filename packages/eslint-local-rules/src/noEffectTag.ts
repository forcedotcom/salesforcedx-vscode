/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { getParserServices, RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import type * as ts from 'typescript';

const effectTagModules = (type: ts.Type, seen: ReadonlySet<ts.Type> = new Set()): (string | undefined)[] => {
  if (seen.has(type)) return [undefined];
  const visited = new Set([...seen, type]);
  const constraint = type.getConstraint();
  if (constraint && constraint !== type) return effectTagModules(constraint, visited);
  // Keep non-Effect union members so specialized helpers are only recommended for the entire union.
  if (type.isUnion()) return type.types.flatMap(part => effectTagModules(part, visited));
  if (type.isIntersection()) {
    const intersectionModules = type.types
      .flatMap(part => effectTagModules(part, visited))
      .filter(module => module !== undefined);
    return intersectionModules.length > 0 ? intersectionModules : [undefined];
  }
  const modules =
    type
      .getProperty('_tag')
      ?.getDeclarations()
      ?.flatMap(declaration => {
        const module = /\/effect\/dist\/dts\/([^/]+)\.d\.ts$/.exec(
          declaration.getSourceFile().fileName.replaceAll('\\', '/')
        )?.[1];
        // Predicate.isTagged refines arbitrary application objects, not an Effect-owned discriminator.
        return module && module !== 'Predicate' ? [module] : [];
      }) ?? [];
  // Option/Either variants also have merged declarations in Effect and STM.
  const specializedModule = ['Option', 'Either', 'Exit'].find(module => modules.includes(module));
  return specializedModule ? [specializedModule] : modules.length > 0 ? modules : [undefined];
};

/** Follow assignment patterns, but not member receivers or computed keys (which are reads). */
const isWriteTarget = (node: TSESTree.Node): boolean => {
  const parent = node.parent;
  if (!parent) return false;
  switch (parent.type) {
    case AST_NODE_TYPES.AssignmentExpression:
    case AST_NODE_TYPES.ForInStatement:
    case AST_NODE_TYPES.ForOfStatement:
      return parent.left === node;
    case AST_NODE_TYPES.UpdateExpression:
      return true;
    case AST_NODE_TYPES.UnaryExpression:
      return parent.operator === 'delete';
    case AST_NODE_TYPES.AssignmentPattern:
      return parent.left === node && isWriteTarget(parent);
    case AST_NODE_TYPES.Property:
      return (
        parent.parent.type === AST_NODE_TYPES.ObjectPattern && parent.value === node && isWriteTarget(parent.parent)
      );
    case AST_NODE_TYPES.ObjectPattern:
    case AST_NODE_TYPES.ArrayPattern:
    case AST_NODE_TYPES.RestElement:
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSTypeAssertion:
      return isWriteTarget(parent);
    default:
      return false;
  }
};

export const noEffectTag = RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow direct reads of _tag on Effect tagged values; use dedicated helpers or Effect matching APIs.'
    },
    schema: [],
    messages: {
      useOptionHelpers:
        'Do not read _tag on an Effect Option. Use Option.isNone or Option.isSome for case checks, or Option.match to handle both cases.',
      useEitherHelpers:
        'Do not read _tag on an Effect Either. Use Either.isLeft or Either.isRight for case checks, or Either.match to handle both cases.',
      useExitMatch: 'Do not read _tag on an Effect Exit. Use Exit.match to handle success and failure.',
      useEffectMatch:
        'Do not read _tag on an Effect tagged value. Use Predicate.isTagged("Tag") from effect/Predicate for a boolean predicate or type guard, or Match.value(value).pipe(Match.tag(...), Match.exhaustive) for dispatch. Preserve intentional partial matches with Match.option or Match.orElse.'
    }
  },
  defaultOptions: [],
  create: context => {
    const services = getParserServices(context);

    const propertyName = (key: TSESTree.Node, computed: boolean): string | undefined => {
      if (key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string') return key.value;
      if (!computed) return key.type === AST_NODE_TYPES.Identifier ? key.name : undefined;
      const type = services.getTypeAtLocation(key);
      return type.isStringLiteral() ? type.value : undefined;
    };

    const destructuredType = (pattern: TSESTree.ObjectPattern | TSESTree.ArrayPattern): ts.Type | undefined => {
      const parent = pattern.parent;
      if (parent.type === AST_NODE_TYPES.AssignmentExpression && parent.left === pattern)
        return services.getTypeAtLocation(parent.right);
      if (parent.type === AST_NODE_TYPES.Property && parent.parent.type === AST_NODE_TYPES.ObjectPattern) {
        const name = propertyName(parent.key, parent.computed);
        const property = name === undefined ? undefined : destructuredType(parent.parent)?.getProperty(name);
        return property ? services.getTypeOfSymbolAtLocation(property, pattern) : undefined;
      }
      if (parent.type === AST_NODE_TYPES.ArrayPattern) {
        const type = destructuredType(parent);
        const property = type?.getProperty(String(parent.elements.indexOf(pattern)));
        return property ? services.getTypeOfSymbolAtLocation(property, pattern) : type?.getNumberIndexType();
      }
      return services.getTypeAtLocation(pattern);
    };

    const report = (type: ts.Type | undefined, key: TSESTree.Node): void => {
      if (!type) return;
      const modules = effectTagModules(type);
      if (!modules.some(module => module !== undefined)) return;
      const specializedModule = modules.every(module => module === modules[0]) ? modules[0] : undefined;
      context.report({
        node: key,
        messageId:
          specializedModule === 'Option'
            ? 'useOptionHelpers'
            : specializedModule === 'Either'
              ? 'useEitherHelpers'
              : specializedModule === 'Exit'
                ? 'useExitMatch'
                : 'useEffectMatch'
      });
    };

    return {
      MemberExpression: (node: TSESTree.MemberExpression): void => {
        if (propertyName(node.property, node.computed) !== '_tag' || isWriteTarget(node)) return;
        const type = services.getTypeAtLocation(node.object);
        report(node.optional ? type.getNonNullableType() : type, node.property);
      },
      Property: (node: TSESTree.Property): void => {
        if (node.parent.type !== AST_NODE_TYPES.ObjectPattern || propertyName(node.key, node.computed) !== '_tag')
          return;
        report(destructuredType(node.parent), node.key);
      }
    };
  }
});
