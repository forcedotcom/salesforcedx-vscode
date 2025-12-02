/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import * as fs from 'node:fs';
import * as path from 'node:path';

type PackageJson = {
  contributes?: {
    commands?: { command: string }[];
  };
};

/** Cache package.json contents per directory to avoid repeated reads */
const packageJsonCache = new Map<string, PackageJson | undefined>();

/** Find and read the nearest package.json, returning contributes.commands */
const getPackageCommands = (filePath: string): Set<string> => {
  const dir = path.dirname(filePath);

  if (packageJsonCache.has(dir)) {
    const cached = packageJsonCache.get(dir);
    return new Set(cached?.contributes?.commands?.map(c => c.command));
  }

  // Walk up directories to find package.json
  const parts = dir.split(path.sep);
  for (let i = parts.length; i > 0; i--) {
    const candidate = path.join(parts.slice(0, i).join(path.sep), 'package.json');
    try {
      const content = fs.readFileSync(candidate, 'utf8');
      const parsed = JSON.parse(content) as PackageJson;
      packageJsonCache.set(dir, parsed);
      return new Set(parsed?.contributes?.commands?.map(c => c.command));
    } catch {
      // Continue searching up
    }
  }

  packageJsonCache.set(dir, undefined);
  return new Set();
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
