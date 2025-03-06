/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OasReorderStep } from '../../../../src/oas/documentProcessorPipeline/oasReorderStep';
import { ProcessorInputOutput } from '../../../../src/oas/documentProcessorPipeline/processorStep';

describe('OasReorderStep', () => {
  let processor: OasReorderStep;

  beforeEach(() => {
    processor = new OasReorderStep();
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
              requestBody: undefined,
              responses: {},
              parameters: []
            }
          }
        }
      }
    };

    const output = await processor.process(input);
    expect(Object.keys(output.openAPIDoc.paths['/examplePath']?.get as any)).toEqual([
      'summary',
      'description',
      'operationId',
      'parameters',
      'requestBody',
      'responses'
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
      }
    };

    const output = await processor.process(input);

    expect(Object.keys(output.openAPIDoc.paths['/examplePath'] as any)).toEqual(['description', 'get', 'post']);
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
      }
    };

    const output = await processor.process(input);

    expect(Object.keys(output.openAPIDoc.paths['/anotherPath'] as any)).toEqual(['post']);
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
      }
    };

    const output = await processor.process(input);

    expect(output.openAPIDoc.paths).toEqual({});
  });
});
