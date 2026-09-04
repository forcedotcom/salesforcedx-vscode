/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StringNode, ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';

import { findNodeAtPath } from './jsonAstUtils';

const extractCommandNodes = (ast: ValueNode): StringNode[] => {
  const commandNodes = findNodeAtPath(ast, ['contributes', 'commands', '*']);
  return commandNodes
    .filter((node): node is ValueNode & { type: 'Object' } => node.type === 'Object')
    .map(node => node.members.find(m => m.name.type === 'String' && m.name.value === 'command')?.value)
    .filter((node): node is StringNode => node?.type === 'String');
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

const extractCommandPaletteIds = (ast: ValueNode): Set<string> =>
  new Set(
    findNodeAtPath(ast, ['contributes', 'menus', 'commandPalette', '*', 'command'])
      .filter((node): node is StringNode => node.type === 'String')
      .map(node => node.value)
  );

export const packageJsonCommandRefs: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate command palette entries and menu command references in package.json'
    },
    schema: [],
    messages: {
      undefinedCommand: 'Command "{{command}}" referenced in menu but not defined in contributes.commands',
      missingCommandPalette: 'Command "{{command}}" is missing from contributes.menus.commandPalette'
    }
  },
  create: context => {
    const filename = context.filename;
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

        const commandNodes = extractCommandNodes(ast);
        const definedCommandIds = new Set(commandNodes.map(commandNode => commandNode.value));
        const referencedCommands = extractReferencedCommands(ast);
        const commandPaletteIds = extractCommandPaletteIds(ast);

        Array.from(referencedCommands.entries())
          .filter(([commandId]) => !definedCommandIds.has(commandId))
          .map(([commandId, commandNode]) => {
            context.report({
              node: commandNode as unknown as Rule.Node,
              messageId: 'undefinedCommand',
              data: { command: commandId }
            });
          });

        commandNodes
          .filter(commandNode => !commandPaletteIds.has(commandNode.value))
          .map(commandNode => {
            context.report({
              node: commandNode as unknown as Rule.Node,
              messageId: 'missingCommandPalette',
              data: { command: commandNode.value }
            });
          });
      }
    } as Rule.RuleListener;
  }
};
