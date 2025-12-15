/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StringNode, ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';

import { findNodeAtPath } from './jsonAstUtils';

const extractCommandIds = (ast: ValueNode): Set<string> => {
  const commandNodes = findNodeAtPath(ast, ['contributes', 'commands', '*']);
  return new Set(
    commandNodes
      .filter((node): node is ValueNode & { type: 'Object' } => node.type === 'Object')
      .map(node => {
        const commandMember = node.members.find(m => m.name.type === 'String' && m.name.value === 'command');
        return commandMember?.value.type === 'String' ? commandMember.value.value : undefined;
      })
      .filter((id): id is string => id !== undefined)
  );
};

const extractReferencedCommands = (ast: ValueNode): Map<string, StringNode> => {
  const menuPaths = [
    ['contributes', 'menus', 'view/title', '*', 'command'],
    ['contributes', 'menus', 'view/item/context', '*', 'command'],
    ['contributes', 'menus', 'editor/context', '*', 'command'],
    ['contributes', 'menus', 'explorer/context', '*', 'command'],
    ['contributes', 'menus', 'commandPalette', '*', 'command']
  ];

  return new Map(
    menuPaths
      .flatMap(path => findNodeAtPath(ast, path))
      .filter((node): node is StringNode => node.type === 'String')
      .map(node => [node.value, node] as [string, StringNode])
  );
};

export const packageJsonCommandRefs: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate command references in package.json menus'
    },
    schema: [],
    messages: {
      undefinedCommand: 'Command "{{command}}" referenced in menu but not defined in contributes.commands',
      orphanedCommand: 'Command "{{command}}" is defined but never referenced in any menu'
    }
  },
  create: context => {
    const filename = context.filename ?? context.getFilename();
    if (!filename.match(/packages\/[^/]+\/package\.json$/)) {
      return {};
    }

    return {
      // @eslint/json provides JSON AST with Document as root node
      'Document:exit': (node: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ast = node?.body as ValueNode | undefined;
        if (ast?.type !== 'Object') {
          return;
        }

        const definedCommands = extractCommandIds(ast);
        const referencedCommands = extractReferencedCommands(ast);

        Array.from(referencedCommands.entries())
          .filter(([commandId]) => !definedCommands.has(commandId))
          .map(([commandId, commandNode]) => {
            context.report({
              node: commandNode as unknown as Rule.Node,
              messageId: 'undefinedCommand',
              data: { command: commandId }
            });
          });

        Array.from(definedCommands)
          .filter(commandId => !referencedCommands.has(commandId))
          .map(commandId => {
            const commandMemberValue = findNodeAtPath(ast, ['contributes', 'commands', '*'])
              .filter((cmdNode): cmdNode is ValueNode & { type: 'Object' } => cmdNode.type === 'Object')
              .map(cmdNode => cmdNode.members.find(m => m.name.type === 'String' && m.name.value === 'command'))
              .find(member => member?.value.type === 'String' && member.value.value === commandId)?.value;

            return commandMemberValue?.type === 'String'
              ? context.report({
                  node: commandMemberValue as unknown as Rule.Node,
                  messageId: 'orphanedCommand',
                  data: { command: commandId }
                })
              : undefined;
          });
      }
    } as Rule.RuleListener;
  }
};
