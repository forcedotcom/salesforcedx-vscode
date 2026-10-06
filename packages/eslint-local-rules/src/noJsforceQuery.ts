/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { getParserServices, RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import type * as ts from 'typescript';

// Resolve the receiver's method symbol to jsforce's Connection or Tooling declarations.
const jsforceConnectionOrToolingDeclaration =
  /[\\/]node_modules[\\/](?:@jsforce[\\/]jsforce-node|jsforce)[\\/].*[\\/](?:connection|tooling)\.d\.ts$/;

const memberName = (node: TSESTree.MemberExpression): string | undefined => {
  if (!node.computed && node.property.type === AST_NODE_TYPES.Identifier) return node.property.name;
  return node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string'
    ? node.property.value
    : undefined;
};

const typeHierarchy = (type: ts.Type): ts.Type[] => {
  const constraint = type.getConstraint();
  if (constraint && constraint !== type) {
    return [type, ...typeHierarchy(constraint)];
  }
  return type.isUnionOrIntersection()
    ? type.types.flatMap(typeHierarchy)
    : [type, ...(type.isClassOrInterface() ? (type.getBaseTypes() ?? []).flatMap(typeHierarchy) : [])];
};

const isJsforceConnectionOrToolingMethod = (type: ts.Type, name: string): boolean =>
  typeHierarchy(type).some(candidate =>
    candidate
      .getProperty(name)
      ?.getDeclarations()
      ?.some(declaration => jsforceConnectionOrToolingDeclaration.test(declaration.getSourceFile().fileName))
  );

export const noJsforceQuery = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct jsforce Connection and Tooling query calls outside QueryService'
    },
    schema: [],
    messages: {
      query: 'Use QueryService.query instead of calling jsforce Connection.query or Tooling.query directly.',
      queryMore: 'Use QueryService.query for pagination instead of calling jsforce queryMore directly.'
    }
  },
  defaultOptions: [],
  create: context => {
    const services = getParserServices(context, true);
    if (services.program === null) return {};
    const checker = services.program.getTypeChecker();

    return {
      CallExpression: (node: TSESTree.CallExpression): void => {
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression) return;

        const name = memberName(callee);
        if (name !== 'query' && name !== 'queryMore') return;

        const receiver = services.esTreeNodeToTSNodeMap.get(callee.object);
        const receiverType = checker.getTypeAtLocation(receiver);
        if (!isJsforceConnectionOrToolingMethod(receiverType, name)) return;

        context.report({ node: callee.property, messageId: name });
      }
    };
  }
});
