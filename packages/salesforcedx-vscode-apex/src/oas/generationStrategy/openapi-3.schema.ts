/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const openAPISchema_v3_0_guided = {
  id: 'https://spec.openapis.org/oas/3.0/schema/2024-10-18',
  $schema: 'http://json-schema.org/draft-04/schema#',
  description: 'The description of OpenAPI v3.0.x Documents',
  type: 'object',
  required: ['openapi', 'info', 'paths'],
  properties: {
    openapi: {
      type: 'string',
      pattern: '^3\\.0\\.\\d(-.+)?$'
    },
    info: {
      $ref: '#/definitions/Info'
    },
    servers: {
      type: 'array',
      items: {
        $ref: '#/definitions/Server'
      }
    },
    paths: {
      type: 'object'
    }
  },
  patternProperties: {
    '^x-': {}
  },
  additionalProperties: false,
  definitions: {
    Info: {
      type: 'object',
      required: ['title', 'version'],
      properties: {
        title: {
          type: 'string'
        },
        description: {
          type: 'string'
        },
        version: {
          type: 'string'
        }
      },
      patternProperties: {
        '^x-': {}
      },
      additionalProperties: false
    },
    Server: {
      type: 'object',
      required: ['url', 'description'],
      properties: {
        url: {
          type: 'string'
        },
        description: {
          type: 'string',
          description:
            'A string describing the host designated by the URL. CommonMark syntax MAY be used for rich text representation.'
        },
        variables: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['default'],
            properties: {
              enum: {
                type: 'array',
                items: {
                  type: 'string'
                }
              },
              default: {
                type: 'string'
              },
              description: {
                type: 'string'
              }
            },
            patternProperties: {
              '^x-': {}
            },
            additionalProperties: false
          }
        }
      },
      patternProperties: {
        '^x-': {}
      },
      additionalProperties: false
    }
  }
};
