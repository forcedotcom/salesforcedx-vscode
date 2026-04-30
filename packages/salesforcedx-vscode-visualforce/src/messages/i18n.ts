/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const messages = {
  name_empty_error: 'Name cannot be empty',
  name_format_error:
    'Name must start with a letter, contain only alphanumeric characters and underscores, not end with an underscore, and not contain consecutive underscores',
  name_max_length_error: 'Name cannot exceed %d characters',
  output_dir_prompt: 'Select output directory',
  vf_page_name_prompt: 'Enter Visualforce page name',
  vf_component_name_prompt: 'Enter Visualforce component name',
  vf_generate_page_success: 'Visualforce page created successfully',
  vf_generate_component_success: 'Visualforce component created successfully',
  visualforce_generate_page_text: 'SFDX: Create Visualforce Page',
  visualforce_generate_component_text: 'SFDX: Create Visualforce Component'
} as const;

export type MessageKey = keyof typeof messages;
