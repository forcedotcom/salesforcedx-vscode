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
 * If omitted, we will assume _message.
 */
export const messages = {
  faux_generation_cancelled_text: 'Faux class generation canceled',
  failure_fetching_sobjects_list_text:
    'Failure fetching list of sObjects from org %s',
  failure_in_sobject_describe_text: 'Failure performing sObject describe %s',
  no_sobject_output_folder_text:
    'No output folder available %s.  Please create this folder and refresh again',
  processed_sobjects_length_text: 'Processed %s %s sObjects\n',
  unsupported_sobject_category:
    'SObject category cannot be used to generate metadata %s',
  no_generate_if_not_in_project:
    'Unable to process sObjects when not in an SFDX project %s',
  class_header_generated_comment: `\/\/ This file is generated as an Apex representation of the
\/\/     corresponding sObject and its fields.
\/\/ This read-only file is used by the Apex Language Server to
\/\/     provide code smartness, and is deleted each time you
\/\/     refresh your sObject definitions.
\/\/ To edit your sObjects and their fields, edit the corresponding
\/\/     .object-meta.xml and .field-meta.xml files.

`
};
