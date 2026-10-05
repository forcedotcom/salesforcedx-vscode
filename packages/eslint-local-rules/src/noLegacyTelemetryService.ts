/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const ALLOWED_FILES = new Set([
  'salesforcedx-utils-vscode/src/services/telemetry.ts',
  'salesforcedx-utils-vscode/src/helpers/telemetryUtils.ts',
  'salesforcedx-vscode-core/src/telemetry/index.ts',
  'salesforcedx-vscode-core/src/index.ts',
  'salesforcedx-vscode-core/src/services/telemetry/telemetryServiceProvider.ts'
]);

const ALLOWED_TEST_DIRECTORIES = [
  'salesforcedx-utils-vscode/test/jest/telemetry/',
  'salesforcedx-vscode-core/test/jest/telemetry/'
];

const isAllowedFile = (filename: string): boolean => {
  const packagePath = filename
    .replaceAll('\\', '/')
    .split(/(?:^|\/)packages\//)
    .at(-1);
  return (
    packagePath !== undefined &&
    (ALLOWED_FILES.has(packagePath) || ALLOWED_TEST_DIRECTORIES.some(directory => packagePath.startsWith(directory)))
  );
};

export const noLegacyTelemetryService = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Ban in-repo legacy telemetry usage outside the frozen core API',
      url: 'https://github.com/forcedotcom/salesforcedx-vscode/blob/main/docs/adr/0012-spans-only-observability.md'
    },
    schema: [],
    messages: {
      noLegacyTelemetryService:
        'Do not use legacy telemetryService or TelemetryService. Wrap work in Effect and use annotateRootSpan (ADR-0012). fireSpan is a last resort, not the default.'
    }
  },
  defaultOptions: [],
  create: context => {
    if (isAllowedFile(context.filename)) return {};

    return {
      ImportDeclaration: (node: TSESTree.ImportDeclaration): void => {
        if (node.source.value !== '@salesforce/salesforcedx-utils-vscode' || node.importKind === 'type') return;

        for (const specifier of node.specifiers) {
          if (
            specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier ||
            (specifier.type === AST_NODE_TYPES.ImportSpecifier &&
              specifier.importKind !== 'type' &&
              (specifier.imported.type === AST_NODE_TYPES.Identifier
                ? specifier.imported.name === 'TelemetryService'
                : specifier.imported.value === 'TelemetryService'))
          ) {
            context.report({ node: specifier, messageId: 'noLegacyTelemetryService' });
          }
        }
      },
      CallExpression: (node: TSESTree.CallExpression): void => {
        const callee = node.callee;
        if (
          callee.type === AST_NODE_TYPES.MemberExpression &&
          callee.object.type === AST_NODE_TYPES.Identifier &&
          callee.object.name === 'TelemetryService' &&
          callee.property.type === AST_NODE_TYPES.Identifier &&
          callee.property.name === 'getInstance' &&
          !callee.computed
        ) {
          context.report({ node: callee, messageId: 'noLegacyTelemetryService' });
        }
      },
      Identifier: (node: TSESTree.Identifier): void => {
        if (node.name === 'telemetryService') {
          context.report({ node, messageId: 'noLegacyTelemetryService' });
        }
      }
    };
  }
});
