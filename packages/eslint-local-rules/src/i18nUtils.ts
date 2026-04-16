/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, ASTUtils, TSESTree } from '@typescript-eslint/utils';

export type MessagesObject = Record<string, string>;

/** Unwrap TSAsExpression if present, otherwise return the node */
const unwrapTSAsExpression = (node: TSESTree.Expression): TSESTree.Expression =>
  node.type === AST_NODE_TYPES.TSAsExpression ? node.expression : node;

/** Extract key from a Property node */
export const extractKey = (prop: TSESTree.Property): string => {
  if (prop.key.type === AST_NODE_TYPES.Identifier) {
    return prop.key.name;
  }
  if (prop.key.type === AST_NODE_TYPES.Literal && typeof prop.key.value === 'string') {
    return prop.key.value;
  }
  return '';
};

/** Extract value from a Property node */
export const extractValue = (prop: TSESTree.Property): string => {
  if (prop.value.type === AST_NODE_TYPES.Literal && typeof prop.value.value === 'string') {
    return prop.value.value;
  }
  if (prop.value.type === AST_NODE_TYPES.TemplateLiteral) {
    return prop.value.quasis.map(q => q.value.cooked ?? '').join('');
  }
  return '';
};

export const extractMessagesObject = (ast: TSESTree.Program): MessagesObject => {
  const messagesDeclarator = ast.body
    .filter(ASTUtils.isNodeOfType(AST_NODE_TYPES.ExportNamedDeclaration))
    .map(stmt => stmt.declaration)
    .filter((decl): decl is TSESTree.VariableDeclaration => decl?.type === AST_NODE_TYPES.VariableDeclaration)
    .flatMap(decl => decl.declarations)
    .find(decl => decl.id.type === AST_NODE_TYPES.Identifier && decl.id.name === 'messages' && decl.init !== null);

  if (!messagesDeclarator?.init) {
    return {};
  }

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

/**
 * LWC SOQL Builder templates use `i18n.key` in text and attributes, e.g.
 * `{i18n.label_foo}` or `placeholder={i18n.placeholder_bar}`.
 * Keep in sync with querybuilderHtmlI18nKeys.
 */
export const collectQuerybuilderI18nKeyRefsFromHtml = (
  source: string,
  knownKeys: Set<string>
): Map<string, number> => {
  const counts = new Map<string, number>();
  const re = /i18n\.([a-zA-Z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const k = m[1];
    if (knownKeys.has(k)) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return counts;
};
