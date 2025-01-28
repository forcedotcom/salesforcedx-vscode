/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { enumeration, pattern, truthy, undefined } from '@stoplight/spectral-functions';
import { oas } from '@stoplight/spectral-rulesets';

const ruleset = {
  extends: [oas],
  // the rules defined below are based on recommendations from https://docs.google.com/document/d/1WwfAPlB4YKHyRhLm1g_hHZja4hjbYkoTrIqIZvGxE5s/edit?tab=t.0
  rules: {
    'openapi-version': {
      description: 'openapi version must be 3.0.0',
      given: '$',
      message: 'openapi version must be 3.0.0',
      then: {
        field: 'openapi',
        function: enumeration,
        functionOptions: {
          values: ['3.0.0']
        }
      }
    },
    'servers-required': {
      description: 'servers should always be a single ‘/services/apexrest’ URL',
      given: '$',
      message: 'servers should always be a single ‘/services/apexrest’ URL',
      then: {
        field: 'servers',
        function: pattern,
        functionOptions: {
          match: '/^/services/aeeprstx$/'
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
    'paths-description': {
      description: 'paths.description is required',
      given: '$.paths',
      message: 'paths.description is required',
      then: {
        field: 'description',
        function: truthy
      }
    },
    'paths-servers': {
      description: 'paths.servers should not be present',
      given: '$.paths.*.',
      message: 'paths.servers should not be present',
      then: {
        field: 'servers',
        function: undefined
      }
    },
    'paths-options': {
      description: 'paths.options should not be present',
      given: '$.paths.*.',
      message: 'paths.options should not be present',
      then: {
        field: 'options',
        function: undefined
      }
    },
    'paths-head': {
      description: 'paths.head should not be present',
      given: '$.paths.*.',
      message: 'paths.head should not be present',
      then: {
        field: 'head',
        function: undefined
      }
    },
    'paths-trace': {
      description: 'paths.trace should not be present',
      given: '$.paths.*.',
      message: 'paths.trace should not be present',
      then: {
        field: 'trace',
        function: undefined
      }
    }
  }
};

export default ruleset;
