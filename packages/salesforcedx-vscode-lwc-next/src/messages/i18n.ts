/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If ommitted, we will assume _message.
 */
export const messages = {
  salesforcedx_vscode_core_not_installed_text:
    'salesforce.salesforcedx-vscode-lwc failed to activate. Ensure that you have the latest version of salesforce.salesforcedx-vscode-core installed and activated',

  force_lightning_lwc_create_text: 'SFDX: Create Lightning Web Component',

  warning_prompt_lightning_bundle_overwrite:
    'A Lightning Web Component with the specified path already exists in your workspace. Do you want to overwrite any existing files in this bundle?',
  warning_prompt_overwrite_confirm: 'Overwrite',
  warning_prompt_overwrite_cancel: 'Cancel'
};
