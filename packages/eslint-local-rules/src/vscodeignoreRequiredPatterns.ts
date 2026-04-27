/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Rule } from 'eslint';
import * as fs from 'node:fs';
import * as pathModule from 'node:path';

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

type VscodeignoreLine = {
  readonly line: number;
  readonly value: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== undefined && value !== null;

const readJsonRecord = (filePath: string): Record<string, unknown> | undefined => {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const parseVscodeignoreLine = (lineText: string): string | undefined => {
  try {
    const parsed = JSON.parse(lineText);
    return typeof parsed === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const getVscodeignoreLines = (sourceLines: string[]): VscodeignoreLine[] =>
  sourceLines
    .map((lineText, index) => {
      const parsed = parseVscodeignoreLine(lineText);
      return parsed === undefined
        ? undefined
        : {
            line: index + 1,
            value: parsed
          };
    })
    .filter((line): line is VscodeignoreLine => line !== undefined);

export const vscodeignoreRequiredPatterns: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Web extensions must include required patterns in .vscodeignore'
    },
    schema: [],
    messages: {
      missingRequiredPattern: 'Web extension .vscodeignore is missing required pattern: "{{pattern}}"',
      missingExistingDirPattern: 'Web extension .vscodeignore is missing pattern for existing directory: "{{pattern}}"'
    }
  },
  create: context => ({
    'Program:exit': programNode => {
      const filename = context.filename ?? context.getFilename();
      if (!filename.endsWith('.vscodeignore')) {
        return;
      }

      const packageDir = pathModule.dirname(pathModule.resolve(filename));
      const packageJson = readJsonRecord(pathModule.join(packageDir, 'package.json'));
      if (packageJson?.browser === undefined) {
        return;
      }

      const sourceLines = context.sourceCode.getLines();
      const parsedLines = getVscodeignoreLines(sourceLines);
      const configuredPatterns = new Set(
        parsedLines.map(line => line.value.trim()).filter(line => line.length > 0 && !line.startsWith('#'))
      );
      const firstLine = parsedLines[0]?.line ?? 1;

      REQUIRED_STATIC_ENTRIES.filter(pattern => !configuredPatterns.has(pattern)).map(pattern =>
        context.report({
          node: programNode,
          loc: {
            start: { line: firstLine, column: 0 },
            end: { line: firstLine, column: 0 }
          },
          messageId: 'missingRequiredPattern',
          data: { pattern }
        })
      );

      EXISTENCE_CHECKED_DIRS.filter(pattern => {
        const existingDirPath = pathModule.join(packageDir, pattern.replace(/\/\*\*$/, ''));
        return (
          fs.existsSync(existingDirPath) &&
          fs.statSync(existingDirPath).isDirectory() &&
          !configuredPatterns.has(pattern)
        );
      }).map(pattern =>
        context.report({
          node: programNode,
          loc: {
            start: { line: firstLine, column: 0 },
            end: { line: firstLine, column: 0 }
          },
          messageId: 'missingExistingDirPattern',
          data: { pattern }
        })
      );
    }
  })
};
