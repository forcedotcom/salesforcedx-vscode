/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as tsParser from '@typescript-eslint/parser';
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { extractKey, extractMessagesObject } from './i18nUtils';

const DEFAULT_DYNAMIC_KEY_PATTERNS = ['^[A-Z][a-zA-Z0-9]*$'];

type RuleOptions = {
  allowList?: string[];
  dynamicKeyPatterns?: string[];
};

const DEFAULT_OPTIONS: RuleOptions = {};

const unwrapAsExpression = (node: TSESTree.Expression): TSESTree.Expression =>
  node.type === AST_NODE_TYPES.TSAsExpression
    ? unwrapAsExpression(node.expression)
    : node;

const addRef = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

const findPackageRoot = (file: string): string | undefined => {
  let dir = path.dirname(file);
  const root = path.parse(file).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return undefined;
};

const findTsFiles = (packageRoot: string): string[] => {
  const result: string[] = [];
  const searchDirs = ['src', 'test']
    .map(d => path.join(packageRoot, d))
    .filter(d => fs.existsSync(d));

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (
        entry.isDirectory() &&
        entry.name !== 'node_modules' &&
        !entry.name.startsWith('.')
      ) {
        walk(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts')
      ) {
        result.push(full);
      }
    }
  };

  searchDirs.forEach(walk);
  return result;
};

const loadPackageNlsKeys = (packageRoot: string): Set<string> => {
  try {
    const content = fs.readFileSync(
      path.join(packageRoot, 'package.nls.json'),
      'utf8'
    );
    const nls = JSON.parse(content) as Record<string, string>;
    return new Set(Object.keys(nls));
  } catch {
    return new Set();
  }
};

const isNlsLocalizeCall = (node: TSESTree.CallExpression): boolean =>
  node.callee.type === AST_NODE_TYPES.MemberExpression &&
  node.callee.object.type === AST_NODE_TYPES.Identifier &&
  node.callee.object.name === 'nls' &&
  node.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.property.name === 'localize';

const isCoerceMessageKeyCall = (node: TSESTree.CallExpression): boolean =>
    node.callee.type === AST_NODE_TYPES.Identifier &&
  node.callee.name === 'coerceMessageKey';

const isKeyExcludedByPattern = (key: string, patterns: string[]): boolean =>
  patterns.some(p => {
    try {
      return new RegExp(p).test(key);
    } catch {
      return false;
    }
  });

const collectReferenceCountsFromSource = (
  source: string,
  knownKeys: Set<string>
): Map<string, number> => {
  const counts = new Map<string, number>();

  let ast: TSESTree.Program;
  try {
    ast = tsParser.parse(source, {
      sourceType: 'module',
      ecmaVersion: 2020
    }) as unknown as TSESTree.Program;
  } catch {
    return counts;
  }

  const visitor = (node: TSESTree.Node): void => {
    switch (node.type) {
      case AST_NODE_TYPES.CallExpression: {
        const first = node.arguments[0];
        if (
          first?.type === AST_NODE_TYPES.Literal &&
          typeof first.value === 'string'
        ) {
          if (isNlsLocalizeCall(node) || isCoerceMessageKeyCall(node)) {
            addRef(counts, first.value);
          }
        }
        break;
      }

      case AST_NODE_TYPES.Literal: {
        if (
          typeof node.value === 'string' &&
          knownKeys.has(node.value)
        ) {
          addRef(counts, node.value);
        }
        break;
      }

      case AST_NODE_TYPES.MemberExpression: {
        if (
          node.object.type === AST_NODE_TYPES.Identifier &&
          node.object.name === 'messages' &&
          node.property.type === AST_NODE_TYPES.Identifier &&
          knownKeys.has(node.property.name)
        ) {
          addRef(counts, node.property.name);
        }
        break;
      }
    }

    const nodeRecord = node as unknown as Record<string, unknown>;
    for (const value of Object.values(nodeRecord)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v && typeof v === 'object' && 'type' in v) visitor(v as TSESTree.Node);
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        visitor(value as TSESTree.Node);
      }
    }
  };

  visitor(ast);
  return counts;
};

export const noUnusedI18nMessages = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        description:
        'Options for configuring unused i18n message detection.',
        properties: {
          allowList: {
            description:
            'Keys that should never be reported as unused.',
            type: 'array',
            items: { type: 'string' }
          },
          dynamicKeyPatterns: {
            description:
            'Regex patterns for keys used dynamically at runtime.',
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    ],
    defaultOptions: [DEFAULT_OPTIONS],
    messages: {
      unused:
        'Message key "{{key}}" is not used. Remove it or add to allowList if used via constants.',
      invalidAllowListEntry:
        'allowList entry "{{key}}" does not exist in this messages file. Remove it from the allowList in eslint.config.mjs.'
    }
  },
  defaultOptions: [DEFAULT_OPTIONS],

  create: (context, [opts = DEFAULT_OPTIONS]) => {
    const filename = context.getFilename();
    if (!filename.replaceAll('\\', '/').endsWith('messages/i18n.ts')) {
      return {};
    }

    const packageRoot = findPackageRoot(filename);
    if (!packageRoot) return {};

    const allowList = new Set(opts.allowList);
    const dynamicPatterns =
      opts.dynamicKeyPatterns ?? DEFAULT_DYNAMIC_KEY_PATTERNS;

    const nlsKeys = loadPackageNlsKeys(packageRoot);

    let knownKeys = new Set<string>();
    try {
      const source = fs.readFileSync(filename, 'utf8');
      const ast = tsParser.parse(source, {
        sourceType: 'module',
        ecmaVersion: 2020
      }) as unknown as TSESTree.Program;

      knownKeys = new Set(Object.keys(extractMessagesObject(ast)));
    } catch {
      // ignore
    }

    const refCounts = new Map<string, number>();
    nlsKeys.forEach(k => addRef(refCounts, k));

    for (const file of findTsFiles(packageRoot)) {
      if (path.resolve(file) === path.resolve(filename)) continue;

      try {
        const source = fs.readFileSync(file, 'utf8');
        const fileCounts = collectReferenceCountsFromSource(
          source,
          knownKeys
        );
        for (const [k, c] of fileCounts) {
          refCounts.set(k, (refCounts.get(k) ?? 0) + c);
        }
      } catch {
        // skip
      }
    }

    let messagesObject: TSESTree.ObjectExpression | null = null;

    return {
      VariableDeclarator: (node: TSESTree.VariableDeclarator) => {
        if (
          node.id.type === AST_NODE_TYPES.Identifier &&
          node.id.name === 'messages' &&
          node.init
        ) {
          const init = unwrapAsExpression(node.init);
          if (init.type === AST_NODE_TYPES.ObjectExpression) {
            messagesObject = init;
          }
        }
      },

      Property: (node: TSESTree.Property) => {
        if (!messagesObject || node.parent !== messagesObject) {
          return;
        }

        const key = extractKey(node);
        if (!key) return;

        if (
          (refCounts.get(key) ?? 0) > 0 ||
          allowList.has(key) ||
          isKeyExcludedByPattern(key, dynamicPatterns)
        ) {
          return;
        }

        context.report({
          node: node.key,
          messageId: 'unused',
          data: { key }
        });
      },

      'Program:exit': (node: TSESTree.Program) => {
        for (const key of allowList) {
          if (!knownKeys.has(key)) {
            context.report({
              node,
              messageId: 'invalidAllowListEntry',
              data: { key }
            });
          }
        }
      }
    };
  }
});
