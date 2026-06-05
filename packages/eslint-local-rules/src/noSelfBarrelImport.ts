/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

// Matches bare-ancestor specifiers: '.', '..', '../..', '../../..', etc.
const BARE_ANCESTOR_PATTERN = /^\.(\.\/\.\.)*$|^\.\.(\/\.\.)*$/;

const isBareAncestorImport = (source: TSESTree.StringLiteral | TSESTree.TemplateLiteral): string | undefined => {
  if (source.type === AST_NODE_TYPES.Literal && typeof source.value === 'string') {
    return BARE_ANCESTOR_PATTERN.test(source.value) ? source.value : undefined;
  }
  if (source.type === AST_NODE_TYPES.TemplateLiteral) {
    if (source.expressions.length === 0 && source.quasis.length === 1) {
      const cooked = source.quasis[0]?.value.cooked;
      if (typeof cooked === 'string' && BARE_ANCESTOR_PATTERN.test(cooked)) return cooked;
    }
  }
  return undefined;
};

export const noSelfBarrelImport = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: "Disallow importing from a package's own barrel via bare-ancestor specifiers ('.', '..', '../..')"
    },
    schema: [],
    messages: {
      noSelfBarrel:
        "Importing from `{{source}}` resolves to the package's barrel (`{{source}}/index.ts`) which re-exports multiple files. Replace with a direct import from the specific file that defines each named export (open the barrel to find the source)."
    }
  },
  defaultOptions: [],
  create: context => ({
    ImportDeclaration: (node: TSESTree.ImportDeclaration): void => {
      if (!node.source) return;
      const matched = isBareAncestorImport(node.source);
      if (matched === undefined) return;
      context.report({
        node,
        messageId: 'noSelfBarrel',
        data: { source: matched }
      });
    }
  })
});
