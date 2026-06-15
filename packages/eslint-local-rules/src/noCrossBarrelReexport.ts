/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Relative specifiers: './x', '../x', '.', '..', '../..' etc. */
const isRelative = (specifier: string): boolean =>
  specifier === '.' || specifier === '..' || /^\.\.?\//.test(specifier);

/** Extract the package-name prefix of a specifier (scoped = first 2 segments, else first). */
const packageNameOf = (specifier: string): string => {
  const segments = specifier.split('/');
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
};

/** Memoized fs self-discovery of workspace package names from each repo packages/<pkg>/package.json. */
let discoveredWorkspacePackages: Set<string> | undefined;

const discoverWorkspacePackages = (filePath: string): Set<string> => {
  if (discoveredWorkspacePackages) return discoveredWorkspacePackages;

  const parts = path.dirname(filePath).split(path.sep);
  for (let i = parts.length; i > 0; i--) {
    const packagesDir = path.join(parts.slice(0, i).join(path.sep), 'packages');
    try {
      const names = fs
        .readdirSync(packagesDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => {
          try {
            const parsed = JSON.parse(fs.readFileSync(path.join(packagesDir, entry.name, 'package.json'), 'utf8')) as {
              name?: string;
            };
            return parsed.name;
          } catch {
            return undefined;
          }
        })
        .filter((name): name is string => typeof name === 'string');
      if (names.length > 0) {
        discoveredWorkspacePackages = new Set(names);
        return discoveredWorkspacePackages;
      }
    } catch {
      // Continue searching up
    }
  }

  discoveredWorkspacePackages = new Set();
  return discoveredWorkspacePackages;
};

type RuleOptions = [{ knownWorkspacePackages?: string[] }];

export const noCrossBarrelReexport = RuleCreator.withoutDocs<RuleOptions, 'noCrossBarrelReexport'>({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow re-exporting from relative paths or internal workspace packages outside of index.ts barrel files'
    },
    schema: [
      {
        type: 'object',
        properties: {
          knownWorkspacePackages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Explicit list of workspace package names (overrides fs self-discovery)'
          }
        },
        additionalProperties: false
      }
    ],
    defaultOptions: [{}],
    messages: {
      noCrossBarrelReexport:
        'Re-exporting from `{{source}}` is only allowed in index.ts barrels. Import directly from the file/package defining each export, or re-export from index.ts (3rd-party API surface re-exports are exempt).'
    }
  },
  defaultOptions: [{}],
  create: (context, [options]) => {
    if (path.basename(context.filename) === 'index.ts') return {};

    const workspacePackages =
      options.knownWorkspacePackages && options.knownWorkspacePackages.length > 0
        ? new Set(options.knownWorkspacePackages)
        : discoverWorkspacePackages(context.filename);

    const check = (node: TSESTree.ExportAllDeclaration | TSESTree.ExportNamedDeclaration): void => {
      if (!node.source) return;
      const source = node.source.value;
      if (typeof source !== 'string') return;
      if (!isRelative(source) && !workspacePackages.has(packageNameOf(source))) return;
      context.report({ node, messageId: 'noCrossBarrelReexport', data: { source } });
    };

    return {
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check
    };
  }
});
