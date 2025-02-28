/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JSONPath } from 'jsonpath-plus';
import { OpenAPIV3 } from 'openapi-types';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

export class PropertyCorrectionStep implements ProcessorStep {
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    let fixedOASDoc = this.ensureServersIsPresent(input.openAPIDoc);
    fixedOASDoc = this.ensureInfoVersionIsPresent(fixedOASDoc);
    fixedOASDoc = this.ensurePathDescriptionIsPresent(fixedOASDoc);
    fixedOASDoc = this.ensureResponseDescriptionsArePresent(fixedOASDoc);
    fixedOASDoc = this.ensureParameterDescriptionsArePresent(fixedOASDoc);
    fixedOASDoc = this.ensureRequestBodyDescriptionsArePresent(fixedOASDoc);
    fixedOASDoc = this.ensureResponseContentsArePresent(fixedOASDoc);
    fixedOASDoc = this.ensureSecuritySectionsAreRemoved(fixedOASDoc);

    return new Promise(resolve => {
      resolve({ ...input, openAPIDoc: fixedOASDoc });
    });
  }

  private ensureInfoVersionIsPresent(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    return { ...oasDoc, ...{ info: { ...oasDoc.info, ...{ version: '1.0.0' } } } };
  }

  private ensureServersIsPresent(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    return { ...oasDoc, ...{ servers: [{ url: '/services/apexrest' }] } };
  }

  private ensurePathDescriptionIsPresent(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    const paths = JSONPath({ path: '$.paths[*][*]', json: oasDoc }) as OpenAPIV3.OperationObject[];

    paths.forEach(path => {
      if (path && !path.description) {
        path.description = 'Default description for the endpoint.';
      }
    });

    return oasDoc;
  }

  private ensureResponseDescriptionsArePresent(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    return this.ensureDescriptionsArePresent(
      oasDoc,
      '$.paths[*][*].responses[*]',
      'Default description for the response.'
    );
  }

  private ensureParameterDescriptionsArePresent(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    return this.ensureDescriptionsArePresent(
      oasDoc,
      '$.paths[*][*].parameters[*]',
      'Default description for the parameter.'
    );
  }

  private ensureRequestBodyDescriptionsArePresent(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    const requestBodies = JSONPath({
      path: '$.paths[*][*].requestBody',
      json: oasDoc
    }) as OpenAPIV3.RequestBodyObject[];

    requestBodies.forEach(requestBody => {
      if (requestBody && !requestBody.description) {
        requestBody.description = 'Default description for the requestBody.';
      }
    });

    return oasDoc;
  }

  private ensureDescriptionsArePresent(
    oasDoc: OpenAPIV3.Document<{}>,
    jsonPath: string,
    defaultDescription: string
  ): OpenAPIV3.Document<{}> {
    const items = JSONPath({ path: jsonPath, json: oasDoc }) as { description?: string }[];

    items.forEach(item => {
      if (item && typeof item === 'object' && (!Reflect.has(item, 'description') || !item.description)) {
        item.description = defaultDescription;
      }
    });

    return oasDoc;
  }

  private ensureResponseContentsArePresent(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    const responses = JSONPath({ path: '$.paths[*][*].responses[*]', json: oasDoc }) as OpenAPIV3.ResponseObject[];

    responses.forEach(response => {
      if (response && !response.content) {
        response.content = {
          'application/json': {
            schema: {
              type: 'object'
            }
          }
        };
      }
    });

    return oasDoc;
  }

  private ensureSecuritySectionsAreRemoved(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
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
  }
}
