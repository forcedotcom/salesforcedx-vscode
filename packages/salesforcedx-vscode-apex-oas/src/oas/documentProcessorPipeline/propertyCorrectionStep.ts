/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProcessorInputOutput } from './processorStep';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { JSONPath } from 'jsonpath-plus';
import type { OpenAPIV3 } from 'openapi-types';
import { hasAuraFrameworkCapability } from '../../oasUtils';

const ensureInfoVersionIsPresent = (oasDoc: OpenAPIV3.Document): OpenAPIV3.Document => ({
  ...oasDoc,
  info: { ...oasDoc.info, version: '1.0.0' }
});

const ensureServersIsPresent =
  (input: ProcessorInputOutput) =>
  (oasDoc: OpenAPIV3.Document): OpenAPIV3.Document =>
    input.context && hasAuraFrameworkCapability(input.context)
      ? oasDoc
      : { ...oasDoc, servers: [{ url: '/services/apexrest' }] };

const ensureDescriptionsAt =
  (jsonPath: string, defaultDescription: string) =>
  (oasDoc: OpenAPIV3.Document): OpenAPIV3.Document => {
    const items = JSONPath<{ description?: string }[]>({ path: jsonPath, json: oasDoc });
    items.forEach(item => {
      if (item && typeof item === 'object' && (!Reflect.has(item, 'description') || !item.description)) {
        item.description = defaultDescription;
      }
    });
    return oasDoc;
  };

const ensureResponseContentsArePresent = (oasDoc: OpenAPIV3.Document): OpenAPIV3.Document => {
  const responses = JSONPath<OpenAPIV3.ResponseObject[]>({ path: '$.paths[*][*].responses[*]', json: oasDoc });
  responses.forEach(response => {
    if (response && !response.content) {
      response.content = { 'application/json': { schema: { type: 'object' } } };
    }
  });
  return oasDoc;
};

const ensureSecuritySectionsAreRemoved = (oasDoc: OpenAPIV3.Document): OpenAPIV3.Document => {
  delete oasDoc.security;
  const securityParents = JSONPath({ path: '$.paths.*.*.security', json: oasDoc, resultType: 'parent' });
  securityParents.forEach((parent: { security?: unknown }) => {
    if (parent && typeof parent === 'object') {
      delete parent.security;
    }
  });
  return oasDoc;
};

export const propertyCorrectionStep = Effect.fn('ApexOas.Process.propertyCorrection')(function* (
  input: ProcessorInputOutput
) {
  const fixedOASDoc = pipe(
    input.openAPIDoc,
    ensureServersIsPresent(input),
    ensureInfoVersionIsPresent,
    ensureDescriptionsAt('$.paths[*]', 'Default description for the path.'),
    ensureDescriptionsAt('$.paths[*][*]', 'Default description for the operation.'),
    ensureDescriptionsAt('$.paths[*][*].responses[*]', 'Default description for the response.'),
    ensureDescriptionsAt('$.paths[*][*].parameters[*]', 'Default description for the parameter.'),
    ensureDescriptionsAt('$.paths[*][*].requestBody', 'Default description for the requestBody.'),
    ensureResponseContentsArePresent,
    ensureSecuritySectionsAreRemoved
  );
  return { ...input, openAPIDoc: fixedOASDoc };
});
