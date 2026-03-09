/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const messages = {
  predicates_no_folder_opened_text: 'No folder opened. Open a Salesforce DX project in VS Code.',
  predicates_no_salesforce_project_found_text:
    'No sfdx-project.json found in the root directory of your open project. Open a Salesforce DX project in VS Code.'
} as const;

export type MessageKey = keyof typeof messages;
