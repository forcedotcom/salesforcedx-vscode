/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const SERVICES_PACKAGE_PATTERN = /^salesforcedx-vscode-services/;

const isServicesImport = (source: TSESTree.StringLiteral | TSESTree.TemplateLiteral): boolean => {
  if (source.type === AST_NODE_TYPES.Literal && typeof source.value === 'string') {
    return SERVICES_PACKAGE_PATTERN.test(source.value);
  }
  if (source.type === AST_NODE_TYPES.TemplateLiteral) {
    // Template literals in imports are rare, but check if it's a static string
    if (source.expressions.length === 0 && source.quasis.length === 1) {
      const cooked = source.quasis[0]?.value.cooked;
      return typeof cooked === 'string' && SERVICES_PACKAGE_PATTERN.test(cooked);
    }
  }
  return false;
};

const hasNonTypeSpecifier = (specifiers: TSESTree.ImportSpecifier[]): boolean =>
  specifiers.some(spec => spec.importKind !== 'type');

export const noDirectServicesImports = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct imports from salesforcedx-vscode-services - use type-only imports instead',
      url: 'https://github.com/forcedotcom/salesforcedx-vscode/blob/main/packages/salesforcedx-vscode-services/README.md#usage-example-consuming-services-from-other-extensions'
    },
    schema: [],
    messages: {
      noDirectImport:
        'Direct imports from salesforcedx-vscode-services are not allowed. Use "import type" for types, and access services through the extension API. See: https://github.com/forcedotcom/salesforcedx-vscode/blob/main/packages/salesforcedx-vscode-services/README.md#usage-example-consuming-services-from-other-extensions'
    }
  },
  defaultOptions: [],
  create: context => ({
    ImportDeclaration: (node: TSESTree.ImportDeclaration): void => {
      if (!node.source) return;

      // Check if this is an import from salesforcedx-vscode-services
      if (!isServicesImport(node.source)) return;

      // Allow if the entire import is type-only (import type { ... })
      if (node.importKind === 'type') return;

      // Check named imports
      const namedSpecifiers = node.specifiers.filter(
        (spec): spec is TSESTree.ImportSpecifier => spec.type === AST_NODE_TYPES.ImportSpecifier
      );

      // If there are no named specifiers (e.g., import '...' or import * as ...), block it
      if (namedSpecifiers.length === 0) {
        context.report({
          node,
          messageId: 'noDirectImport'
        });
        return;
      }

      // Check if any specifier is not type-only
      if (hasNonTypeSpecifier(namedSpecifiers)) {
        context.report({
          node,
          messageId: 'noDirectImport'
        });
      }
    }
  })
});
