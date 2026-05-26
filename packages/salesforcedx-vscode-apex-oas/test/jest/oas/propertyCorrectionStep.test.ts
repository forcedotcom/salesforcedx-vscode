/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { JSONPath } from 'jsonpath-plus';
import { OpenAPIV3 } from 'openapi-types';
import { propertyCorrectionStep } from '../../../src/oas/documentProcessorPipeline/propertyCorrectionStep';
import { ProcessorInputOutput } from '../../../src/oas/documentProcessorPipeline/processorStep';

describe('propertyCorrectionStep', () => {
  let openAPIDoc: OpenAPIV3.Document;

  beforeEach(() => {
    openAPIDoc = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: ''
      },
      security: [
        {
          apiKeyAuth: []
        }
      ],
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
            },
            security: [
              {
                apiKeyAuth: []
              }
            ]
          }
        }
      }
    };
  });

  const run = async (doc: OpenAPIV3.Document): Promise<OpenAPIV3.Document> => {
    const input: ProcessorInputOutput = {
      errors: [],
      openAPIDoc: doc,
      context: undefined
    };
    const output = await Effect.runPromise(propertyCorrectionStep(input));
    return output.openAPIDoc;
  };

  it('ensures info version is present', async () => {
    const result = await run(openAPIDoc);
    expect(result.info.version).toBe('1.0.0');
  });

  it('ensures servers are present', async () => {
    const result = await run(openAPIDoc);
    expect(result.servers).toEqual([{ url: '/services/apexrest' }]);
  });

  it('preserves existing response descriptions', async () => {
    const result = await run(openAPIDoc);
    const responseDescriptions = JSONPath({ path: '$.paths[*][*].responses[*].description', json: result });
    expect(responseDescriptions).toContain('this one is ok');
  });

  it('fills empty parameter descriptions with default', async () => {
    const result = await run(openAPIDoc);
    const parameterDescriptions = JSONPath({ path: '$.paths[*][*].parameters[*].description', json: result });
    expect(parameterDescriptions).toContain('Default description for the parameter.');
  });

  it('fills missing request body descriptions with default', async () => {
    const result = await run(openAPIDoc);
    const requestBodyDescriptions = JSONPath({ path: '$.paths[*][*].requestBody.description', json: result });
    expect(requestBodyDescriptions).toContain('Default description for the requestBody.');
  });

  it('removes security sections at root and within methods', async () => {
    const result = await run(openAPIDoc);
    const securityEntries = JSONPath({ path: '$..security', json: result });
    expect(securityEntries.length).toBe(0);
  });
});
