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

const findPackageRoot = (i18nPath: string): string | undefined => {
  let dir = path.dirname(i18nPath);
  const root = path.parse(i18nPath).root;
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
  const searchDirs = [
    path.join(packageRoot, 'src'),
    path.join(packageRoot, 'test')
  ].filter(d => fs.existsSync(d));

  const walk = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        result.push(fullPath);
      }
    }
  };

  for (const searchDir of searchDirs) {
    walk(searchDir);
  }
  return result;
};

const loadPackageNlsKeys = (packageRoot: string): Set<string> => {
  const nlsPath = path.join(packageRoot, 'package.nls.json');
  try {
    const content = fs.readFileSync(nlsPath, 'utf8');
    const nls = JSON.parse(content) as Record<string, string>;
    return new Set(Object.keys(nls));
  } catch {
    return new Set();
  }
};

const collectLiteralStringArg = (node: TSESTree.CallExpression): string | undefined => {
  const firstArg = node.arguments[0];
  if (firstArg?.type === AST_NODE_TYPES.Literal && typeof firstArg.value === 'string') {
    return firstArg.value;
  }
  return undefined;
};

const isNlsLocalizeCall = (node: TSESTree.CallExpression): boolean =>
  node.callee.type === AST_NODE_TYPES.MemberExpression &&
  node.callee.object.type === AST_NODE_TYPES.Identifier &&
  node.callee.object.name === 'nls' &&
  node.callee.property.type === AST_NODE_TYPES.Identifier &&
  node.callee.property.name === 'localize';

const isCoerceMessageKeyCall = (node: TSESTree.CallExpression): boolean =>
  node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'coerceMessageKey';

const traverse = (node: unknown, visitor: (n: TSESTree.CallExpression) => void): void => {
  if (!node || typeof node !== 'object' || !('type' in node) || typeof (node as { type: unknown }).type !== 'string') {
    return;
  }
  const n = node as TSESTree.Node;
  if (n.type === AST_NODE_TYPES.CallExpression) {
    visitor(n);
  }
  for (const value of Object.values(n as unknown as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      value.forEach(v => traverse(v, visitor));
    } else {
      traverse(value, visitor);
    }
  }
};

const traverseLiterals = (
  node: unknown,
  visitor: (n: TSESTree.Literal) => void
): void => {
  if (!node || typeof node !== 'object' || !('type' in node) || typeof (node as { type: unknown }).type !== 'string') {
    return;
  }
  const n = node as TSESTree.Node;
  if (n.type === AST_NODE_TYPES.Literal && typeof (n as TSESTree.Literal).value === 'string') {
    visitor(n as TSESTree.Literal);
  }
  for (const value of Object.values(n as unknown as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      value.forEach(v => traverseLiterals(v, visitor));
    } else {
      traverseLiterals(value, visitor);
    }
  }
};

const traverseMemberExpressions = (
  node: unknown,
  visitor: (n: TSESTree.MemberExpression) => void
): void => {
  if (!node || typeof node !== 'object' || !('type' in node) || typeof (node as { type: unknown }).type !== 'string') {
    return;
  }
  const n = node as TSESTree.Node;
  if (
    n.type === AST_NODE_TYPES.MemberExpression &&
    n.object.type === AST_NODE_TYPES.Identifier &&
    n.property.type === AST_NODE_TYPES.Identifier
  ) {
    visitor(n);
  }
  for (const value of Object.values(n as unknown as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      value.forEach(v => traverseMemberExpressions(v, visitor));
    } else {
      traverseMemberExpressions(value, visitor);
    }
  }
};

const collectUsedKeysFromSource = (
  source: string,
  knownKeys: Set<string>
): Set<string> => {
  const usedKeys = new Set<string>();
  let ast: TSESTree.Program;
  try {
    ast = tsParser.parse(source, {
      sourceType: 'module',
      ecmaVersion: 2020
    }) as unknown as TSESTree.Program;
  } catch {
    return usedKeys;
  }

  traverse(ast, node => {
    const key = collectLiteralStringArg(node);
    if (key && (isNlsLocalizeCall(node) || isCoerceMessageKeyCall(node))) {
      usedKeys.add(key);
    }
  });

  traverseLiterals(ast, node => {
    const value = node.value;
    if (typeof value === 'string' && knownKeys.has(value)) {
      usedKeys.add(value);
    }
  });

  traverseMemberExpressions(ast, node => {
    const obj = node.object as TSESTree.Identifier;
    const prop = node.property as TSESTree.Identifier;
    if (obj.name === 'messages' && knownKeys.has(prop.name)) {
      usedKeys.add(prop.name);
    }
  });
  return usedKeys;
};

const isKeyExcludedByPattern = (key: string, patterns: string[]): boolean =>
  patterns.some(p => {
    try {
      return new RegExp(p).test(key);
    } catch {
      return false;
    }
  });

export const noUnusedI18nMessages = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Report unused message keys in i18n.ts. Considers a key used if it appears in nls.localize(), coerceMessageKey(), package.nls.json, as any string literal, or as messages.key property access'
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowList: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keys to never report (e.g. used via constants)'
          },
          dynamicKeyPatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Regex patterns for keys used only at runtime'
          }
        },
        additionalProperties: false
      }
    ],
    defaultOptions: [DEFAULT_OPTIONS],
    messages: {
      unused: 'Message key "{{key}}" is not used. Remove it or add to allowList if used via constants.'
    }
  },
  defaultOptions: [DEFAULT_OPTIONS],
  create: (context, [opts = DEFAULT_OPTIONS]) => {
    const filename = context.filename ?? context.getFilename();
    const normalized = filename.replaceAll('\\', '/');
    if (!normalized.endsWith('messages/i18n.ts')) {
      return {};
    }

    const packageRoot = findPackageRoot(filename);
    if (!packageRoot) {
      return {};
    }

    const allowList = new Set(opts.allowList);
    const dynamicPatterns = opts.dynamicKeyPatterns ?? DEFAULT_DYNAMIC_KEY_PATTERNS;
    const nlsKeys = loadPackageNlsKeys(packageRoot);

    let knownKeys = new Set<string>();
    try {
      const i18nSource = fs.readFileSync(filename, 'utf8');
      const i18nAst = tsParser.parse(i18nSource, {
        sourceType: 'module',
        ecmaVersion: 2020
      }) as unknown as TSESTree.Program;
      knownKeys = new Set(Object.keys(extractMessagesObject(i18nAst)));
    } catch {
      // Fallback: usedKeys will only have nls/coerce/package.nls
    }

    const usedKeys = new Set<string>(nlsKeys);
    for (const filePath of findTsFiles(packageRoot)) {
      try {
        const source = fs.readFileSync(filePath, 'utf8');
        for (const k of collectUsedKeysFromSource(source, knownKeys)) {
          usedKeys.add(k);
        }
      } catch {
        // Skip unreadable files
      }
    }

    return {
      Property: (node: TSESTree.Property): void => {
        if (node.parent?.type !== AST_NODE_TYPES.ObjectExpression) {
          return;
        }

        const grandparent = node.parent.parent;
        const declarator =
          grandparent?.type === AST_NODE_TYPES.TSAsExpression ? grandparent.parent : grandparent;

        if (
          declarator?.type !== AST_NODE_TYPES.VariableDeclarator ||
          declarator.id.type !== AST_NODE_TYPES.Identifier ||
          declarator.id.name !== 'messages'
        ) {
          return;
        }

        const key = extractKey(node);
        if (
          !key ||
          usedKeys.has(key) ||
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
      }
    };
  }
});
