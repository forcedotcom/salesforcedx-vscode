/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

// Matches bare-ancestor specifiers: '.', '..', '../..', '../../..', etc.
const BARE_ANCESTOR_PATTERN = /^\.(\.\/\.\.)*$|^\.\.(\/\.\.)*$/;

const matchBareAncestor = (source: TSESTree.StringLiteral): string | undefined =>
  typeof source.value === 'string' && BARE_ANCESTOR_PATTERN.test(source.value) ? source.value : undefined;

export const noSelfBarrelImport = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: "Disallow importing from a package's own barrel via bare-ancestor specifiers ('.', '..', '../..')"
    },
    schema: [],
    messages: {
      noSelfBarrel:
        "Importing from `{{source}}` resolves to the package's barrel (`{{source}}/index.ts`). Replace with direct import from file defining each export (open barrel to find source)."
    }
  },
  defaultOptions: [],
  create: context => {
    const check = (
      node: TSESTree.ImportDeclaration | TSESTree.ExportAllDeclaration | TSESTree.ExportNamedDeclaration
    ): void => {
      if (!node.source) return;
      const matched = matchBareAncestor(node.source);
      if (matched === undefined) return;
      context.report({ node, messageId: 'noSelfBarrel', data: { source: matched } });
    };
    return {
      ImportDeclaration: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check
    };
  }
});
