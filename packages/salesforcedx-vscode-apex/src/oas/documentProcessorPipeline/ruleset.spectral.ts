/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { enumeration, schema, truthy, undefined } from '@stoplight/spectral-functions';
import { oas } from '@stoplight/spectral-rulesets';

const ruleset = {
  extends: [oas],
  // the rules defined below are based on recommendations from https://docs.google.com/document/d/1WwfAPlB4YKHyRhLm1g_hHZja4hjbYkoTrIqIZvGxE5s/edit?tab=t.0
  rules: {
    'info-contact': {
      description: 'info-contact rule disabled',
      given: '$',
      message: 'info-contact rule disabled',
      then: {
        field: 'info',
        function: schema,
        functionOptions: {
          schema: {
            type: 'object',
            properties: {
              contact: {}
            }
          }
        }
      }
    },
    'operation-tag-defined': {
      description: 'operation-tag-defined rule disabled',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operation-tag-defined rule disabled',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            type: 'object',
            properties: {
              tags: {}
            }
          }
        }
      }
    },
    'operation-tags': {
      description: 'operation-tags rule disabled',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operation-tags rule disabled',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            type: 'object',
            properties: {
              tags: {}
            }
          }
        }
      }
    },
    'openapi-version': {
      description: 'openapi version must be 3.0.x',
      given: '$',
      message: 'openapi version must be 3.0.x',
      then: {
        field: 'openapi',
        function: schema,
        functionOptions: {
          schema: {
            type: 'string',
            pattern: '^3\\.0\\.[0-9]+$'
          }
        }
      }
    },
    'oas3-api-servers': {
      description: 'servers should always be a single URL',
      given: '$',
      message: 'servers should always be a single URL',
      then: {
        field: 'servers',
        function: schema,
        functionOptions: {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              patternProperties: {
                url: {
                  type: 'string',
                  pattern: '(/services/apexrest|/aura-controllers/custom)'
                }
              }
            },
            minItems: 1,
            maxItems: 1
          }
        }
      }
    },
    'security-schemes': {
      description: 'Apex REST supports these authentication mechanisms: Type: OAuth2 or Type: HTTP, Scheme: Bearer',
      given: '$.components.securitySchemes.*',
      message: 'Apex REST supports these authentication mechanisms: Type: OAuth2 or Type: HTTP, Scheme: Bearer',
      then: [
        {
          field: 'type',
          function: enumeration,
          functionOptions: {
            values: ['OAuth2', 'HTTP']
          }
        },
        {
          field: 'scheme',
          function: enumeration,
          functionOptions: {
            values: ['Bearer']
          }
        }
      ]
    },
    'paths-method-description': {
      description: 'paths.<method>.description is required',
      given: '$.paths.*',
      message: 'paths.<method>.description is required',
      then: {
        field: 'description',
        function: truthy
      }
    },
    'paths-method-servers': {
      description: 'paths.<method>.servers should not be present',
      given: '$.paths.*.',
      message: 'paths.<method>.servers should not be present',
      then: {
        field: 'servers',
        function: undefined
      }
    },
    'paths-method-options': {
      description: 'paths.<method>.options should not be present',
      given: '$.paths.*.',
      message: 'paths.<method>.options should not be present',
      then: {
        field: 'options',
        function: undefined
      }
    },
    'paths-method-head': {
      description: 'paths.<method>.head should not be present',
      given: '$.paths.*.',
      message: 'paths.<method>.head should not be present',
      then: {
        field: 'head',
        function: undefined
      }
    },
    'paths-method-trace': {
      description: 'paths.<method>.trace should not be present',
      given: '$.paths.*.',
      message: 'paths.<method>.trace should not be present',
      then: {
        field: 'trace',
        function: undefined
      }
    },
    'info-description': {
      description: 'info.description is required',
      given: '$.info',
      message: 'info.description is required',
      then: {
        field: 'description',
        function: truthy
      }
    },
    'operations-description': {
      description: 'operations.description is required',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.description is required',
      then: {
        field: 'description',
        function: truthy
      }
    },
    'operations-callbacks': {
      description: 'operations.callbacks should not be present',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.callbacks should not be present',
      then: {
        field: 'callbacks',
        function: undefined
      }
    },
    'operations-deprecated': {
      description: 'operations.deprecated should not be present',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.deprecated should not be present',
      then: {
        field: 'deprecated',
        function: undefined
      }
    },
    'operations-security': {
      description: 'operations.security should not be present',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.security should not be present',
      then: {
        field: 'security',
        function: undefined
      }
    },
    'operations-servers': {
      description: 'operations.servers should not be present',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.servers should not be present',
      then: {
        field: 'servers',
        function: undefined
      }
    },
    'request-body-description': {
      description: 'requestBody description is required',
      given: '$.paths[*][get,post,put,delete,patch].requestBody',
      message: 'requestBody description is required',
      then: {
        field: 'description',
        function: truthy
      }
    },
    'request-body-content': {
      description: 'requestBody content must be /application/json',
      given: '$.paths[*][get,post,put,delete,patch].requestBody',
      message: 'requestBody content must be /application/json',
      then: {
        field: 'content',
        function: schema,
        functionOptions: {
          schema: {
            type: 'object',
            properties: {
              'application/json': { type: 'object' }
            },
            additionalProperties: false
          }
        }
      }
    },
    'paths-parameters-in': {
      description: 'paths.parameters in `cookie` is not allowed',
      given: '$.paths[*]',
      message: 'paths.parameters in `cookie` is not allowed',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array'
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    patternProperties: {
                      in: {
                        not: {
                          type: 'string',
                          enum: ['cookie']
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'operations-parameters-in': {
      description: 'operations.parameters in `cookie` is not allowed',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.parameters in `cookie` is not allowed',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array'
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    patternProperties: {
                      in: {
                        type: 'string',
                        enum: ['query', 'header', 'path']
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'paths-parameters-description': {
      description: 'paths.parameters.description is required',
      given: '$.paths[*]',
      message: 'paths.parameters.description is required',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array'
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      description: {
                        type: 'string'
                      }
                    },
                    required: ['description']
                  }
                }
              }
            }
          }
        }
      }
    },
    'operations-parameters-description': {
      description: 'operations.parameters.description is required',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.parameters.description is required',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array'
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      description: {
                        type: 'string'
                      }
                    },
                    required: ['description']
                  }
                }
              }
            }
          }
        }
      }
    },
    'paths-parameters-deprecated': {
      description: 'path.parameters.deprecated is not allowed',
      given: '$.paths[*]',
      message: 'path.parameters.deprecated is not allowed',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array'
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      in: { type: 'string' },
                      description: {
                        type: 'string'
                      },
                      required: { type: 'boolean' },
                      allowEmptyValue: { type: 'boolean' },
                      style: { type: 'string' },
                      explode: { type: 'boolean' },
                      allowReserved: { type: 'boolean' },
                      schema: { type: 'object' },
                      example: {},
                      examples: { type: 'object' },
                      content: { type: 'object' }
                    },
                    additionalProperties: false
                  }
                }
              }
            }
          }
        }
      }
    },
    'operations-parameters-deprecated': {
      description: 'operations.parameters.deprecated is not allowed',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.parameters.deprecated is not allowed',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array'
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      in: { type: 'string' },
                      description: {
                        type: 'string'
                      },
                      required: { type: 'boolean' },
                      allowEmptyValue: { type: 'boolean' },
                      style: { type: 'string' },
                      explode: { type: 'boolean' },
                      allowReserved: { type: 'boolean' },
                      schema: { type: 'object' },
                      example: {},
                      examples: { type: 'object' },
                      content: { type: 'object' }
                    },
                    additionalProperties: false
                  }
                }
              }
            }
          }
        }
      }
    },
    'paths-parameters-explode': {
      description: 'path.parameters.explode should be set to false',
      given: '$.paths[*]',
      message: 'path.parameters.explode should be set to false',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      explode: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      explode: { enum: [false] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'operations-parameters-explode': {
      description: 'operations.parameters.explode should be set to false',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.parameters.explode should be set to false',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      explode: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      explode: { enum: [false] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'paths-parameters-allowReserved': {
      description: 'path.parameters.allowReserved should be set to false',
      given: '$.paths[*]',
      message: 'path.parameters.allowReserved should be set to false',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      allowReserved: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      allowReserved: { enum: [false] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'operations-parameters-allowReserved': {
      description: 'operations.parameters.allowReserved should be set to false',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.parameters.allowReserved should be set to false',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      allowReserved: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      allowReserved: { enum: [false] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'paths-parameters-content': {
      description: 'path.parameters.content should be `application/json`',
      given: '$.paths[*]',
      message: 'path.parameters.content should be `application/json`',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      content: { type: 'string' }
                    }
                  }
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      content: { enum: ['application/json'] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'operations-parameters-content': {
      description: 'operations.parameters.content should be `application/json`',
      given: '$.paths[*][get,post,put,delete,patch]',
      message: 'operations.parameters.content should be `application/json`',
      then: {
        function: schema,
        functionOptions: {
          schema: {
            if: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      content: { type: 'string' }
                    }
                  }
                }
              }
            },
            then: {
              properties: {
                parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      content: { enum: ['application/json'] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    'response-headers': {
      description: 'operations.responses.headers are not allowed',
      given: '$.paths[*][get,post,put,delete,patch].responses.*',
      message: 'operations.responses.headers are not allowed',
      then: {
        field: 'headers',
        function: undefined
      }
    },
    'response-content': {
      description: 'operations.responses.content should be application/json',
      given: '$.paths[*][get,post,put,delete,patch].responses.*',
      message: 'operations.responses.content should be application/json',
      then: {
        field: 'content',
        function: schema,
        functionOptions: {
          schema: {
            type: 'object',
            properties: {
              'application/json': { type: 'object' }
            },
            additionalProperties: false
          }
        }
      }
    },
    'request-media-encoding': {
      description: 'request-media-encoding is not allowed',
      given: '$.paths[*][get,post,put,delete,patch].requestBody.content.*',
      message: 'request-media-encoding is not allowed',
      then: {
        field: 'encoding',
        function: undefined
      }
    },
    'response-media-encoding': {
      description: 'response-media-encoding is not allowed',
      given: '$.paths[*][get,post,put,delete,patch].responses.*.content.*',
      message: 'response-media-encoding is not allowed',
      then: {
        field: 'encoding',
        function: undefined
      }
    }
  }
};

export default ruleset;
