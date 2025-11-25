/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as tsParser from '@typescript-eslint/parser';
import { AST_NODE_TYPES, ASTUtils, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import * as fs from 'node:fs';
import * as path from 'node:path';

type MessagesObject = Record<string, string>;

/** Unwrap TSAsExpression if present, otherwise return the node */
const unwrapTSAsExpression = (node: TSESTree.Expression): TSESTree.Expression =>
  node.type === AST_NODE_TYPES.TSAsExpression ? node.expression : node;

/** Extract key from a Property node */
const extractKey = (prop: TSESTree.Property): string => {
  if (prop.key.type === AST_NODE_TYPES.Identifier) {
    return prop.key.name;
  }
  if (prop.key.type === AST_NODE_TYPES.Literal && typeof prop.key.value === 'string') {
    return prop.key.value;
  }
  return '';
};

/** Extract value from a Property node */
const extractValue = (prop: TSESTree.Property): string => {
  if (prop.value.type === AST_NODE_TYPES.Literal && typeof prop.value.value === 'string') {
    return prop.value.value;
  }
  if (prop.value.type === AST_NODE_TYPES.TemplateLiteral) {
    return prop.value.quasis.map(q => q.value.cooked ?? '').join('');
  }
  return '';
};

const extractMessagesObject = (ast: TSESTree.Program): MessagesObject => {
  const messagesDeclarator = ast.body
    .filter(ASTUtils.isNodeOfType(AST_NODE_TYPES.ExportNamedDeclaration))
    .map(stmt => stmt.declaration)
    .filter((decl): decl is TSESTree.VariableDeclaration => decl?.type === AST_NODE_TYPES.VariableDeclaration)
    .flatMap(decl => decl.declarations)
    .find(decl => decl.id.type === AST_NODE_TYPES.Identifier && decl.id.name === 'messages' && decl.init !== null);

  if (!messagesDeclarator?.init) {
    return {};
  }

  // Handle 'as const' (TSAsExpression)
  const objExpr = unwrapTSAsExpression(messagesDeclarator.init);

  if (objExpr.type !== AST_NODE_TYPES.ObjectExpression) {
    return {};
  }

  const entries = objExpr.properties
    .filter(ASTUtils.isNodeOfType(AST_NODE_TYPES.Property))
    .filter(
      (prop): prop is TSESTree.Property =>
        (prop.key.type === AST_NODE_TYPES.Identifier ||
          (prop.key.type === AST_NODE_TYPES.Literal && typeof prop.key.value === 'string')) &&
        (prop.value.type === AST_NODE_TYPES.Literal || prop.value.type === AST_NODE_TYPES.TemplateLiteral)
    )
    .map(prop => [extractKey(prop), extractValue(prop)] as const);

  return Object.fromEntries(entries);
};

const isEnglishMessage = (text: string): boolean => {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // URLs should not be considered as needing translation
  if (/^https?:\/\//.test(text.trim())) {
    return false;
  }

  // Remove all technical patterns and clean up extra whitespace
  const cleanedText = technicalPatterns
    .reduce((acc, pattern) => acc.replaceAll(pattern, ''), text)
    .replaceAll(/\s+/g, ' ')
    .trim();

  // If nothing left after removing technical elements, consider it technical-only
  if (!cleanedText) {
    return false; // Pure technical string, don't flag as English
  }

  // Check if remaining content is English (including common technical characters)
  const englishRegex = /^[A-Za-z0-9\s.,!?;:'"()\\-–—/_]*$/;
  return englishRegex.test(cleanedText);
};

export const noDuplicateI18nValues = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow English text in translation files that should be localized'
    },
    schema: [],
    fixable: 'code',
    messages: {
      duplicateValue: 'Translation for "{{key}}" duplicates the English value and should be localized.',
      englishValue: 'Translation for "{{key}}" appears to be in English and should be localized.'
    }
  },
  defaultOptions: [],
  create: context => {
    const filename = context.filename ?? context.getFilename();
    // Check if this is a translation file (not the base i18n.ts)
    if (!filename.match(/i18n\.[a-z]{2}\.ts$/)) {
      return {};
    }

    const enPath = path.resolve(path.dirname(filename), 'i18n.ts');

    let enSource: string;
    try {
      enSource = fs.readFileSync(enPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read base i18n file at ${enPath}`, { cause: error });
    }

    let enAst: TSESTree.Program;
    try {
      enAst = tsParser.parse(enSource, {
        sourceType: 'module',
        ecmaVersion: 2020
      }) as unknown as TSESTree.Program;
    } catch (error) {
      throw new Error(`Failed to parse base i18n file at ${enPath}`, { cause: error });
    }

    const enMessages: MessagesObject = extractMessagesObject(enAst);
    return {
      Property: (node: TSESTree.Property): void => {
        // Check if this property is part of a messages object
        // Structure can be: messages = { prop } OR messages = { prop } as const
        if (node.parent?.type !== AST_NODE_TYPES.ObjectExpression) {
          return;
        }

        // Handle both direct and "as const" cases
        const initialDeclarator = node.parent.parent;
        const declarator =
          initialDeclarator?.type === AST_NODE_TYPES.TSAsExpression ? initialDeclarator.parent : initialDeclarator;

        if (
          declarator?.type !== AST_NODE_TYPES.VariableDeclarator ||
          declarator.id.type !== AST_NODE_TYPES.Identifier ||
          declarator.id.name !== 'messages'
        ) {
          return;
        }

        const key = extractKey(node);
        const translationValue = extractValue(node);
        const enValue = enMessages[key];

        // Check if the translation value appears to be English
        if (isEnglishMessage(translationValue)) {
          const isDuplicate = enValue === translationValue;

          context.report({
            node,
            messageId: isDuplicate ? 'duplicateValue' : 'englishValue',
            data: { key },
            fix: fixer => {
              // If it's a duplicate, remove it; otherwise, just flag it for manual review
              if (!isDuplicate) return null;

              const sourceCode = context.sourceCode ?? context.getSourceCode();
              const nextToken = sourceCode.getTokenAfter(node);
              const prevToken = sourceCode.getTokenBefore(node);

              if (!node.range) return null;

              if (nextToken?.value === ',' && nextToken.range) {
                return fixer.removeRange([node.range[0], nextToken.range[1]]);
              }

              if (prevToken?.value === ',' && prevToken.range) {
                return fixer.removeRange([prevToken.range[0], node.range[1]]);
              }

              return fixer.remove(node);
            }
          });
        }
      }
    };
  }
});

// Remove all technical elements that are language-neutral
const technicalPatterns = [
  /%[sdifjoO%]/g, // util.format: %s, %d, %i, %f, %j, %o, %O, %%
  /\$\([^)]+\)/g, // codicons: $(icon-name)
  /\{\d+\}/g, // numbered placeholders: {0}, {1}
  /\{[a-zA-Z0-9_]+\}/g, // named placeholders: {name}, {count}
  /\[[^\]]*\]/g, // bracketed technical terms: [DEBUG]
  /https?:\/\/[^\s]+/g, // URLs
  /[A-Z_]{3,}/g // ALL_CAPS constants (optional)
];
