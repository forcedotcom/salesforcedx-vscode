/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import { isVscodeWindowMethodCall } from './astUtils';

export const noVscodeShowTextDocument = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Use fsService.showTextDocument instead of vscode.window.showTextDocument.'
    },
    schema: [],
    messages: {
      useFsService: 'Use fsService.showTextDocument instead of vscode.window.showTextDocument.'
    }
  },
  defaultOptions: [],
  create: context => ({
    CallExpression: (node: TSESTree.CallExpression): void => {
      if (isVscodeWindowMethodCall(node, 'showTextDocument')) {
        context.report({ node: node.callee, messageId: 'useFsService' });
      }
    }
  })
});
