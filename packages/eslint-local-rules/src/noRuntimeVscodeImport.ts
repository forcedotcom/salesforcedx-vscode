/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

// A declaration is a runtime load (not fully type-erased) when it is not a
// `import type ...` declaration AND it either is a bare side-effect import or
// has at least one value-kind specifier.
const isRuntimeLoad = (node: TSESTree.ImportDeclaration): boolean => {
  if (node.importKind === 'type') return false;
  if (node.specifiers.length === 0) return true;
  return node.specifiers.some(
    specifier => !(specifier.type === AST_NODE_TYPES.ImportSpecifier && specifier.importKind === 'type')
  );
};

export const noRuntimeVscodeImport = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban runtime imports of the `vscode` module in Playwright tests. They run in the test-runner/browser where `vscode` is absent, so the import fails at runtime. Use `import type` for types, or the UI-driven helpers (e.g. openFileByName) instead.'
    },
    schema: [],
    messages: {
      noRuntimeVscodeImport:
        'Do not import the `vscode` module at runtime in Playwright tests; it is unavailable in the test-runner and the import fails. Use `import type` for types, or UI-driven helpers (e.g. openFileByName).'
    }
  },
  defaultOptions: [],
  create: context => ({
    ImportDeclaration: (node: TSESTree.ImportDeclaration): void => {
      if (node.source.value === 'vscode' && isRuntimeLoad(node)) {
        context.report({ node: node.source, messageId: 'noRuntimeVscodeImport' });
      }
    },
    CallExpression: (node: TSESTree.CallExpression): void => {
      const arg = node.arguments[0];
      if (
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'require' &&
        arg?.type === AST_NODE_TYPES.Literal &&
        arg.value === 'vscode'
      ) {
        context.report({ node: arg, messageId: 'noRuntimeVscodeImport' });
      }
    },
    ImportExpression: (node: TSESTree.ImportExpression): void => {
      if (node.source.type === AST_NODE_TYPES.Literal && node.source.value === 'vscode') {
        context.report({ node: node.source, messageId: 'noRuntimeVscodeImport' });
      }
    }
  })
});
