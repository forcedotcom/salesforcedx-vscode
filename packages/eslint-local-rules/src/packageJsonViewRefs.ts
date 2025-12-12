/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ValueNode, StringNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';

const findNodeAtPath = (node: ValueNode, pathSegments: string[]): ValueNode[] => {
  if (pathSegments.length === 0) {
    return [node];
  }

  const [key, ...rest] = pathSegments;

  if (node.type === 'Object') {
    const member = node.members.find(m => m.name.type === 'String' && m.name.value === key);
    return member ? findNodeAtPath(member.value, rest) : [];
  }

  if (node.type === 'Array' && key === '*') {
    return node.elements.flatMap(el => findNodeAtPath(el.value, rest));
  }

  if (node.type === 'Array' && /^\d+$/.test(key)) {
    const index = parseInt(key, 10);
    const element = node.elements[index];
    return element ? findNodeAtPath(element.value, rest) : [];
  }

  return [];
};

const extractViewIds = (ast: ValueNode): Set<string> => {
  const viewContainerNodes = findNodeAtPath(ast, ['contributes', 'views', '*', '*']);
  return new Set(
    viewContainerNodes
      .filter((node): node is ValueNode & { type: 'Object' } => node.type === 'Object')
      .map(node => {
        const idMember = node.members.find(m => m.name.type === 'String' && m.name.value === 'id');
        return idMember?.value.type === 'String' ? idMember.value.value : undefined;
      })
      .filter((id): id is string => id !== undefined)
  );
};

const extractReferencedViewIds = (ast: ValueNode): Map<string, StringNode> => {
  const whenPaths = [
    ['contributes', 'menus', 'view/title', '*', 'when'],
    ['contributes', 'menus', 'view/item/context', '*', 'when']
  ];

  const viewWelcomePath = ['contributes', 'viewsWelcome', '*', 'view'];

  const whenClauseReferences = whenPaths
    .flatMap(path => findNodeAtPath(ast, path))
    .filter((node): node is StringNode => node.type === 'String')
    .map(node => {
      const viewMatch = node.value.match(/view\s*==\s*([a-zA-Z0-9._-]+)/);
      return viewMatch ? ([viewMatch[1], node] as [string, StringNode]) : undefined;
    })
    .filter((ref): ref is [string, StringNode] => ref !== undefined);

  const viewWelcomeReferences = findNodeAtPath(ast, viewWelcomePath)
    .filter((node): node is StringNode => node.type === 'String')
    .map(node => [node.value, node] as [string, StringNode]);

  return new Map([...whenClauseReferences, ...viewWelcomeReferences]);
};

export const packageJsonViewRefs: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate view ID references in package.json when clauses and viewsWelcome'
    },
    schema: [],
    messages: {
      undefinedView: 'View ID "{{viewId}}" referenced but not defined in contributes.views',
      orphanedView: 'View ID "{{viewId}}" is defined but never referenced in any menu or viewsWelcome'
    }
  },
  create: context => {
    const filename = context.filename ?? context.getFilename();
    if (!filename.match(/packages\/[^/]+\/package\.json$/)) {
      return {};
    }

    return {
      'Program:exit': (node: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ast = node?.body as ValueNode | undefined;
        if (ast?.type !== 'Object') {
          return;
        }

        const definedViews = extractViewIds(ast);
        const referencedViews = extractReferencedViewIds(ast);

        Array.from(referencedViews.entries())
          .filter(([viewId]) => !definedViews.has(viewId))
          .map(([viewId, viewNode]) => {
            context.report({
              node: viewNode as unknown as Rule.Node,
              messageId: 'undefinedView',
              data: { viewId }
            });
          });

        Array.from(definedViews)
          .filter(viewId => !referencedViews.has(viewId))
          .map(viewId => {
            const idMemberValue = findNodeAtPath(ast, ['contributes', 'views', '*', '*'])
              .filter((viewNode): viewNode is ValueNode & { type: 'Object' } => viewNode.type === 'Object')
              .map(viewNode => viewNode.members.find(m => m.name.type === 'String' && m.name.value === 'id'))
              .find(idMember => idMember?.value.type === 'String' && idMember.value.value === viewId)?.value;

            return idMemberValue?.type === 'String'
              ? context.report({
                  node: idMemberValue as unknown as Rule.Node,
                  messageId: 'orphanedView',
                  data: { viewId }
                })
              : undefined;
          });
      }
    } as Rule.RuleListener;
  }
};
