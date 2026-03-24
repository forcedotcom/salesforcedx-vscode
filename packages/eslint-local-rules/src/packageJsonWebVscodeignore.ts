/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';
import * as fs from 'node:fs';
import * as pathModule from 'node:path';

import { findNodeAtPath } from './jsonAstUtils';

const REQUIRED_STATIC_ENTRIES = [
  '**/*.map',
  'dist/*-metafile.json',
  '**/*.node',
  '.vscode-test-web/**',
  '.wireit/**',
  'out/**',
  'src/**',
  'test/**',
  'node_modules',
  'playwright*.ts',
  'playwright-report/**',
  'test-results/**',
  '**/*.ts',
  'coverage',
  'junit*',
  '*.vsix',
  '.circular-deps.json',
  '.eslintcache',
  '.gitignore',
  'jest.config.js',
  'tsconfig.json',
  '.eslint.json'
];

const EXISTENCE_CHECKED_DIRS = ['scripts/**', 'docs/**'];

const getBrowserNode = (ast: ValueNode): ValueNode | undefined => {
  const browserNodes = findNodeAtPath(ast, ['browser']);
  return browserNodes[0];
};

export const packageJsonWebVscodeignore: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Web extensions (with "browser" field) must have comprehensive .vscodeignore coverage'
    },
    schema: [],
    messages: {
      missingVscodeignore: 'Web extension is missing .vscodeignore file',
      missingRequiredPattern: 'Web extension .vscodeignore is missing required pattern: "{{pattern}}"',
      missingExistingDirPattern: 'Web extension .vscodeignore is missing pattern for existing directory: "{{pattern}}"'
    }
  },
  create: context => {
    const filename = context.filename ?? context.getFilename();
    if (!filename.includes('package.json')) {
      return {};
    }

    return {
      'Document:exit': (node: any) => {
        const ast = node?.body;
        if (ast?.type !== 'Object') return;

        const browserNode = getBrowserNode(ast);
        if (!browserNode) return;

        const dir = pathModule.dirname(pathModule.resolve(filename));
        const vscodeignorePath = pathModule.join(dir, '.vscodeignore');

        if (!fs.existsSync(vscodeignorePath)) {
          context.report({
            node: browserNode as unknown as Rule.Node,
            messageId: 'missingVscodeignore'
          });
          return;
        }

        const content = fs.readFileSync(vscodeignorePath, 'utf-8');
        const lines = new Set(
          content
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'))
        );

        // Check static required entries
        REQUIRED_STATIC_ENTRIES.forEach(pattern => {
          if (!lines.has(pattern)) {
            context.report({
              node: browserNode as unknown as Rule.Node,
              messageId: 'missingRequiredPattern',
              data: { pattern }
            });
          }
        });

        // Check existence-checked directories
        EXISTENCE_CHECKED_DIRS.forEach(pattern => {
          const dirName = pattern.replace(/\/\*\*$/, '');
          const fullDirPath = pathModule.join(dir, dirName);
          if (fs.existsSync(fullDirPath) && fs.statSync(fullDirPath).isDirectory()) {
            if (!lines.has(pattern)) {
              context.report({
                node: browserNode as unknown as Rule.Node,
                messageId: 'missingExistingDirPattern',
                data: { pattern }
              });
            }
          }
        });
      }
    } as Rule.RuleListener;
  }
};
