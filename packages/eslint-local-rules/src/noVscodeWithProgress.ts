/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import { isVscodeWindowMethodCall } from './astUtils';

export const noVscodeWithProgress = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Use PromptService progress operators instead of vscode.window.withProgress.'
    },
    schema: [],
    messages: {
      usePromptService: 'Use PromptService progress operators instead of vscode.window.withProgress.'
    }
  },
  defaultOptions: [],
  create: context => {
    const filename = context.filename.replaceAll('\\', '/');
    // These files own the V2 progress adapter and native SDK progress lifecycle. Their raw VS Code boundary
    // is the implementation of PromptService, not a consumer bypassing it.
    if (
      filename.endsWith('/salesforcedx-vscode-services/src/vscode/prompts/promptService.ts') ||
      filename.endsWith('/salesforcedx-vscode-services/src/services/promptProgress.ts') ||
      filename.endsWith('/salesforcedx-vscode-services/src/services/nativeMetadataOperation.ts')
    ) {
      return {};
    }
    return {
      CallExpression: (node: TSESTree.CallExpression): void => {
        if (isVscodeWindowMethodCall(node, 'withProgress')) {
          context.report({ node: node.callee, messageId: 'usePromptService' });
        }
      }
    };
  }
});
