/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import { getNearestPackageJson } from './packageJsonUtils';

const getPackageCommands = (filePath: string): Set<string> => {
  const pkg = getNearestPackageJson(filePath);
  return new Set(pkg?.contributes?.commands?.map(c => c.command));
};

type RuleOptions = [{ ignorePatterns?: string[] }];

export const commandMustBeInPackageJson = RuleCreator.withoutDocs<RuleOptions, 'missingCommand'>({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require registerCommand command IDs to be declared in package.json contributes.commands'
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignorePatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Regex patterns for command IDs to ignore (internal commands)'
          }
        },
        additionalProperties: false
      }
    ],
    defaultOptions: [{ ignorePatterns: [] }],
    messages: {
      missingCommand:
        "Command '{{commandId}}' is registered but not declared in package.json contributes.commands. Add it to package.json."
    }
  },
  defaultOptions: [{ ignorePatterns: [] }],
  create: (context, [options]) => {
    const ignoreRegexes = (options.ignorePatterns ?? []).map(p => new RegExp(p));

    return {
      CallExpression: (node: TSESTree.CallExpression): void => {
        // Match: vscode.commands.registerCommand('command.id', ...)
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;
        if (node.callee.property.type !== AST_NODE_TYPES.Identifier) return;
        if (node.callee.property.name !== 'registerCommand') return;

        // Check it's vscode.commands.registerCommand
        const obj = node.callee.object;
        if (obj.type !== AST_NODE_TYPES.MemberExpression) return;
        if (obj.object.type !== AST_NODE_TYPES.Identifier || obj.object.name !== 'vscode') return;
        if (obj.property.type !== AST_NODE_TYPES.Identifier || obj.property.name !== 'commands') return;

        // Get the first argument (command ID)
        const firstArg = node.arguments[0];
        if (!firstArg) return;
        if (firstArg.type !== AST_NODE_TYPES.Literal || typeof firstArg.value !== 'string') return;

        const commandId = firstArg.value;

        // Check if command matches any ignore pattern
        if (ignoreRegexes.some(re => re.test(commandId))) return;

        const packageCommands = getPackageCommands(context.filename);

        if (!packageCommands.has(commandId)) {
          context.report({
            node: firstArg,
            messageId: 'missingCommand',
            data: { commandId }
          });
        }
      }
    };
  }
});
