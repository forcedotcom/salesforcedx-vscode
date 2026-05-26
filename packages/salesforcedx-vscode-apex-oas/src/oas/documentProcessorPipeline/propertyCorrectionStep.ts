/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JSONPath } from 'jsonpath-plus';
import type { OpenAPIV3 } from 'openapi-types';
import { hasAuraFrameworkCapability } from '../../oasUtils';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

const ensureInfoVersionIsPresent = (oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> => ({
  ...oasDoc,
  info: { ...oasDoc.info, version: '1.0.0' }
});

const ensureServersIsPresent = (oasDoc: OpenAPIV3.Document<{}>, input: ProcessorInputOutput): OpenAPIV3.Document<{}> =>
  input.context && hasAuraFrameworkCapability(input.context)
    ? oasDoc
    : { ...oasDoc, servers: [{ url: '/services/apexrest' }] };

const ensureDescriptionsArePresent = (
  oasDoc: OpenAPIV3.Document<{}>,
  jsonPath: string,
  defaultDescription: string
): OpenAPIV3.Document<{}> => {
  const items = JSONPath<{ description?: string }[]>({ path: jsonPath, json: oasDoc });

  items.forEach(item => {
    if (item && typeof item === 'object' && (!Reflect.has(item, 'description') || !item.description)) {
      item.description = defaultDescription;
    }
  });

  return oasDoc;
};

const ensureResponseContentsArePresent = (oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> => {
  const responses = JSONPath<OpenAPIV3.ResponseObject[]>({ path: '$.paths[*][*].responses[*]', json: oasDoc });

  responses.forEach(response => {
    if (response && !response.content) {
      response.content = {
        'application/json': {
          schema: { type: 'object' }
        }
      };
    }
  });

  return oasDoc;
};

const ensureSecuritySectionsAreRemoved = (oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> => {
  // delete security section from root
  delete oasDoc.security;

  // Find all parent elements where "security" is a direct descendant and remove the "security" property
  const securityParents = JSONPath({ path: '$.paths.*.*.security', json: oasDoc, resultType: 'parent' });

  securityParents.forEach((parent: { security?: unknown }) => {
    if (parent && typeof parent === 'object') {
      delete parent.security;
    }
  });

  return oasDoc;
};

export const propertyCorrectionStep: ProcessorStep = {
  process: (input: ProcessorInputOutput): Promise<ProcessorInputOutput> => {
    let fixedOASDoc = ensureServersIsPresent(input.openAPIDoc, input);
    fixedOASDoc = ensureInfoVersionIsPresent(fixedOASDoc);
    fixedOASDoc = ensureDescriptionsArePresent(fixedOASDoc, '$.paths[*]', 'Default description for the path.');
    fixedOASDoc = ensureDescriptionsArePresent(fixedOASDoc, '$.paths[*][*]', 'Default description for the operation.');
    fixedOASDoc = ensureDescriptionsArePresent(
      fixedOASDoc,
      '$.paths[*][*].responses[*]',
      'Default description for the response.'
    );
    fixedOASDoc = ensureDescriptionsArePresent(
      fixedOASDoc,
      '$.paths[*][*].parameters[*]',
      'Default description for the parameter.'
    );
    fixedOASDoc = ensureDescriptionsArePresent(
      fixedOASDoc,
      '$.paths[*][*].requestBody',
      'Default description for the requestBody.'
    );
    fixedOASDoc = ensureResponseContentsArePresent(fixedOASDoc);
    fixedOASDoc = ensureSecuritySectionsAreRemoved(fixedOASDoc);

    return Promise.resolve({ ...input, openAPIDoc: fixedOASDoc });
  }
};
