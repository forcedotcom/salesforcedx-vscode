/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const caseManagerClassText = [
  "@RestResource(urlMapping='/apex-rest-examples/v1/Cases/*')",
  'global with sharing class CaseManager {',
  '  @HttpPost',
  '  global static ID createCase(String subject, String status,',
  '    String origin, String priority) {',
  '    Case thisCase = new Case(',
  '      Subject=subject,',
  '      Status=status,',
  '      Origin=origin,',
  '      Priority=priority);',
  '    insert thisCase;',
  '    return thisCase.Id;',
  '  }',
  '}'
].join('\n');
