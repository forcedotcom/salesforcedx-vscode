/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JSONPath } from 'jsonpath-plus';
import { OpenAPIV3 } from 'openapi-types';
import { PropertyCorrectionStep } from '../../../src/oas/documentProcessorPipeline/propertyCorrectionStep';

describe('PropertyCorrectionStep', () => {
  let step: PropertyCorrectionStep;
  let openAPIDoc: OpenAPIV3.Document;

  beforeEach(() => {
    step = new PropertyCorrectionStep();
    openAPIDoc = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: ''
      },
      paths: {
        '/test': {
          description: '',
          get: {
            responses: {
              200: {
                description: 'this one is ok'
              }
            },
            parameters: [
              {
                name: 'testParam',
                in: 'query',
                description: ''
              }
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            }
          }
        }
      }
    };
  }) as OpenAPIV3.Document;

  it('should ensure info version is present', () => {
    const result = step['ensureInfoVersionIsPresent'](openAPIDoc);
    expect(result.info.version).toBe('1.0.0');
  });

  it('should ensure servers are present', () => {
    const result = step['ensureServersIsPresent'](openAPIDoc);
    expect(result.servers).toEqual([{ url: '/services/apexrest' }]);
  });

  it('should ensure response descriptions are present', () => {
    const result = step['ensureResponseDescriptionsArePresent'](openAPIDoc);
    const responseDescriptions = JSONPath({ path: '$.paths[*][*].responses[*].description', json: result });
    expect(responseDescriptions).toContain('this one is ok');
    expect(responseDescriptions).not.toContain('Default description for the response.');
  });

  it('should ensure parameter descriptions are present', () => {
    const result = step['ensureParameterDescriptionsArePresent'](openAPIDoc);
    const parameterDescriptions = JSONPath({ path: '$.paths[*][*].parameters[*].description', json: result });
    expect(parameterDescriptions).toContain('Default description for the parameter.');
  });

  it('should ensure request body descriptions are present', () => {
    const result = step['ensureRequestBodyDescriptionsArePresent'](openAPIDoc);
    const requestBodyDescriptions = JSONPath({ path: '$.paths[*][*].requestBody.description', json: result });
    expect(requestBodyDescriptions).toContain('Default description for the requestBody.');
  });

  it('should ensure descriptions are present using generic method', () => {
    const result = step['ensureDescriptionsArePresent'](
      openAPIDoc,
      '$.paths[*][*].parameters[*]',
      'Default description for the parameter.'
    );
    const parameterDescriptions = JSONPath({ path: '$.paths[*][*].parameters[*].description', json: result });
    expect(parameterDescriptions).toContain('Default description for the parameter.');
  });
});
