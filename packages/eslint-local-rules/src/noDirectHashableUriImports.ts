/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const HASHABLE_URI_DEEP_PATH = /salesforcedx-vscode-services\/(src\/)?vscode\/hashableUri$/;

const isHashableUriDeepImport = (source: TSESTree.StringLiteral | TSESTree.TemplateLiteral): boolean => {
  if (source.type === AST_NODE_TYPES.Literal && typeof source.value === 'string') {
    return HASHABLE_URI_DEEP_PATH.test(source.value);
  }
  if (source.type === AST_NODE_TYPES.TemplateLiteral) {
    if (source.expressions.length === 0 && source.quasis.length === 1) {
      const cooked = source.quasis[0]?.value.cooked;
      return typeof cooked === 'string' && HASHABLE_URI_DEEP_PATH.test(cooked);
    }
  }
  return false;
};

export const noDirectHashableUriImports = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct imports from salesforcedx-vscode-services/vscode/hashableUri - import HashableUri from package root instead'
    },
    schema: [],
    messages: {
      noDirectImport:
        'Import HashableUri from "salesforcedx-vscode-services" (root), not from the deep "vscode/hashableUri" path.'
    }
  },
  defaultOptions: [],
  create: context => ({
    ImportDeclaration: (node: TSESTree.ImportDeclaration): void => {
      if (!node.source) return;
      if (!isHashableUriDeepImport(node.source)) return;
      context.report({ node, messageId: 'noDirectImport' });
    }
  })
});
