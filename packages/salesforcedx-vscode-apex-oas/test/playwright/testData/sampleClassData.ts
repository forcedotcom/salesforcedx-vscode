/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const caseManagerClassText = [
  'global with sharing class CaseManager {',
  '  @AuraEnabled',
  '  public static String createCase() {',
  "    return 'created';",
  '  }',
  '}'
].join('\n');

export const simpleAccountResourceClassText = [
  'global with sharing class SimpleAccountResource {',
  '  @AuraEnabled',
  '  public static String getAccount() {',
  "    return 'account';",
  '  }',
  '}'
].join('\n');

export const ineligibleApexClassText = [
  'public with sharing class IneligibleApexClass {',
  '  public IneligibleApexClass() {}',
  '}'
].join('\n');

export const restResourceClassText = [
  "@RestResource(urlMapping='/apex-rest-examples/v1/*')",
  'global with sharing class RestResourceClass {',
  '  @HttpGet',
  '  global static String getResource() {',
  "    return 'resource';",
  '  }',
  '}'
].join('\n');

// Mixes Apex REST (@RestResource + @HttpGet) with an @AuraEnabled method — not allowed for OAS generation.
export const mixedFrameworksClassText = [
  "@RestResource(urlMapping='/apex-rest-examples/v1/mixed/*')",
  'global with sharing class MixedFrameworksClass {',
  '  @HttpGet',
  '  global static Account getAccount() {',
  '    RestRequest req = RestContext.request;',
  "    String accountId = req.requestURI.substring(req.requestURI.lastIndexOf('/')+1);",
  '    return [SELECT Id, Name, Phone, Website FROM Account WHERE Id = :accountId];',
  '  }',
  '',
  '  @AuraEnabled',
  '  public static Account getAccountForAura(Id accountId) {',
  '    return [SELECT Id, Name, Phone, Website FROM Account WHERE Id = :accountId];',
  '  }',
  '}'
].join('\n');
