/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { oasReorderStep } from '../../../../src/oas/documentProcessorPipeline/oasReorderStep';
import { ProcessorInputOutput } from '../../../../src/oas/documentProcessorPipeline/processorStep';

describe('oasReorderStep', () => {
  it('reorders info section attributes', async () => {
    const input: ProcessorInputOutput = {
      errors: [],
      openAPIDoc: {
        openapi: '3.0.0',
        info: {
          version: '1.0.0',
          title: 'Example API',
          description: 'An example API'
        },
        paths: {}
      },
      context: undefined
    };

    const output = await Effect.runPromise(oasReorderStep(input));

    expect(Object.keys(output.openAPIDoc.info)).toEqual(['title', 'version', 'description']);
  });

  it('reorders operation-level attributes', async () => {
    const input: ProcessorInputOutput = {
      errors: [],
      openAPIDoc: {
        openapi: '3.0.0',
        info: {
          title: 'Example API',
          version: '1.0.0'
        },
        paths: {
          '/examplePath': {
            get: {
              operationId: 'getExample',
              description: 'Fetches example data',
              summary: 'Get example',
              requestBody: {
                content: {},
                required: true,
                description: 'Request body description'
              },
              responses: {},
              parameters: []
            }
          }
        }
      },
      context: undefined
    };

    const output = await Effect.runPromise(oasReorderStep(input));
    expect(Object.keys(output.openAPIDoc.paths['/examplePath']?.get as object)).toEqual([
      'summary',
      'description',
      'operationId',
      'parameters',
      'requestBody',
      'responses'
    ]);
    expect(Object.keys(output.openAPIDoc.paths['/examplePath']?.get?.requestBody as object)).toEqual([
      'description',
      'required',
      'content'
    ]);
  });

  it('reorders path-level attributes', async () => {
    const input: ProcessorInputOutput = {
      errors: [],
      openAPIDoc: {
        openapi: '3.0.0',
        info: {
          title: 'Example API',
          version: '1.0.0'
        },
        paths: {
          '/examplePath': {
            get: {
              summary: 'Get example',
              description: 'Fetches example data',
              operationId: 'getExample',
              responses: {}
            },
            description: 'This is an example path',
            post: {
              summary: 'Post example',
              operationId: 'postExample',
              responses: {}
            }
          }
        }
      },
      context: undefined
    };

    const output = await Effect.runPromise(oasReorderStep(input));

    expect(Object.keys(output.openAPIDoc.paths['/examplePath'] as object)).toEqual(['description', 'get', 'post']);
  });

  it('does not modify paths without description', async () => {
    const input: ProcessorInputOutput = {
      errors: [],
      openAPIDoc: {
        openapi: '3.0.0',
        info: {
          title: 'Example API',
          version: '1.0.0'
        },
        paths: {
          '/anotherPath': {
            post: {
              summary: 'Post example',
              operationId: 'postExample',
              responses: {}
            }
          }
        }
      },
      context: undefined
    };

    const output = await Effect.runPromise(oasReorderStep(input));

    expect(Object.keys(output.openAPIDoc.paths['/anotherPath'] as object)).toEqual(['post']);
  });

  it('handles empty paths gracefully', async () => {
    const input: ProcessorInputOutput = {
      errors: [],
      openAPIDoc: {
        openapi: '3.0.0',
        info: {
          title: 'Example API',
          version: '1.0.0'
        },
        paths: {}
      },
      context: undefined
    };

    const output = await Effect.runPromise(oasReorderStep(input));

    expect(output.openAPIDoc.paths).toEqual({});
  });
});
