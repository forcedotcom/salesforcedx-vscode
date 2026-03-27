/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Rule } from 'eslint';
import { minimatch } from 'minimatch';
import * as fs from 'node:fs';
import * as pathModule from 'node:path';

type ParsedLine = {
  readonly line: number;
  readonly pattern: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== undefined && value !== null;

const readJsonRecord = (filePath: string): Record<string, unknown> | undefined => {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Traverses a plain JSON value along the given key path, collecting all string leaves.
 * '*' matches all array elements or all object values.
 */
const getStrings = (value: unknown, ...keys: string[]): string[] => {
  if (value === undefined || value === null) return [];
  if (keys.length === 0) return typeof value === 'string' ? [value] : [];
  const [key, ...rest] = keys;
  if (key === '*') {
    if (Array.isArray(value)) return value.flatMap(item => getStrings(item, ...rest));
    if (isRecord(value)) return Object.values(value).flatMap(v => getStrings(v, ...rest));
    return [];
  }
  return isRecord(value) ? getStrings(value[key], ...rest) : [];
};

const extractContributePaths = (pjson: Record<string, unknown>): string[] =>
  [
    ...getStrings(pjson, 'icon'),
    ...getStrings(pjson, 'contributes', 'languages', '*', 'configuration'),
    ...getStrings(pjson, 'contributes', 'grammars', '*', 'path'),
    ...getStrings(pjson, 'contributes', 'snippets', '*', 'path'),
    ...getStrings(pjson, 'contributes', 'jsonValidation', '*', 'url'),
    ...getStrings(pjson, 'contributes', 'debuggers', '*', 'program'),
    ...getStrings(pjson, 'contributes', 'commands', '*', 'icon'),
    ...getStrings(pjson, 'contributes', 'commands', '*', 'icon', 'light'),
    ...getStrings(pjson, 'contributes', 'commands', '*', 'icon', 'dark'),
    ...getStrings(pjson, 'contributes', 'viewsContainers', 'activitybar', '*', 'icon'),
    ...getStrings(pjson, 'contributes', 'walkthroughs', '*', 'steps', '*', 'media', 'image'),
    ...getStrings(pjson, 'contributes', 'icons', '*', 'default', 'fontPath')
  ]
    .filter(p => p.length > 0)
    .map(p => p.replace(/^\.\//, ''))
    .filter(p => !pathModule.isAbsolute(p));

const parseVscodeignoreLine = (lineText: string): string | undefined => {
  try {
    const parsed = JSON.parse(lineText);
    return typeof parsed === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const getPatternLines = (sourceLines: string[]): ParsedLine[] =>
  sourceLines
    .map((lineText, index) => {
      const value = parseVscodeignoreLine(lineText);
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('!')) {
        return undefined;
      }
      return { line: index + 1, pattern: trimmed };
    })
    .filter((l): l is ParsedLine => l !== undefined);

/** Returns the first contribute path that the given vscodeignore pattern would exclude. */
const findConflictingPath = (pattern: string, contributePaths: string[]): string | undefined => {
  const opts = { dot: true };
  return contributePaths.find(contributePath => {
    if (minimatch(contributePath, pattern, opts)) return true;
    // check if pattern matches any ancestor directory of the contribute path
    const parts = contributePath.split('/');
    return parts.slice(1).some((_, i) => minimatch(parts.slice(0, i + 1).join('/'), pattern, opts));
  });
};

export const vscodeignoreContributesConflict: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent .vscodeignore patterns from excluding paths referenced in contributes'
    },
    schema: [],
    messages: {
      conflictsWithContributes:
        'Pattern "{{pattern}}" excludes "{{contributePath}}" which is referenced in package.json contributes'
    }
  },
  create: context => ({
    'Program:exit': programNode => {
      const filename = context.filename ?? context.getFilename();
      if (!filename.endsWith('.vscodeignore')) return;

      const packageDir = pathModule.dirname(pathModule.resolve(filename));
      const pjson = readJsonRecord(pathModule.join(packageDir, 'package.json'));
      if (pjson === undefined) return;

      const contributePaths = extractContributePaths(pjson);
      if (contributePaths.length === 0) return;

      const patternLines = getPatternLines(context.sourceCode.getLines());

      patternLines.map(({ line, pattern }) => {
        const conflicting = findConflictingPath(pattern, contributePaths);
        if (conflicting === undefined) return;
        context.report({
          node: programNode,
          loc: { start: { line, column: 0 }, end: { line, column: pattern.length } },
          messageId: 'conflictsWithContributes',
          data: { pattern, contributePath: conflicting }
        });
      });
    }
  })
};
