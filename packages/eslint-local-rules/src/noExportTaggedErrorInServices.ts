/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_TOKEN_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const hasExportTaggedErrorTag = (comments: TSESTree.Comment[]): boolean =>
  comments.some(c => c.type === AST_TOKEN_TYPES.Block && c.value.includes('@ExportTaggedError'));

export const noExportTaggedErrorInServices = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow @ExportTaggedError JSDoc in salesforcedx-vscode-services — errors here are consumed by other packages and knip correctly sees them as used'
    },
    schema: [],
    messages: {
      noExportTaggedError:
        'Do not use @ExportTaggedError in salesforcedx-vscode-services. Errors exported from this package are consumed by other packages; knip correctly identifies them as used.'
    }
  },
  defaultOptions: [],
  create: context => ({
    ExportNamedDeclaration: (node: TSESTree.ExportNamedDeclaration): void => {
      const sourceCode = context.sourceCode ?? context.getSourceCode();
      if (hasExportTaggedErrorTag(sourceCode.getCommentsBefore(node))) {
        context.report({ node, messageId: 'noExportTaggedError' });
      }
    }
  })
});
