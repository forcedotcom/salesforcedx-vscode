/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { ParsedNodeTypes } from 'jest-editor-support';
import {
  extractPositionFromFailureMessage,
  IExtendedParseResults,
  populateAncestorTitles,
  sanitizeFailureMessage
} from '../../../../src/testSupport/testIndexer/jestUtils';

describe('Jest Utils', () => {
  const mockFsPath =
    '/Users/mockUser/sfdx-simple/force-app/main/default/lwc/demoLwcComponent/__tests__/demoLwcComponent.test.js';
  const mockFailureMessage =
    'Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoEqual\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // deep equality\u001b[22m\n\nExpected: \u001b[32m2\u001b[39m\nReceived: \u001b[31m1\u001b[39m\n    at Object.expect (/Users/mockUser/sfdx-simple/force-app/main/default/lwc/demoLwcComponent/__tests__/demoLwcComponent.test.js:22:5)\n    at Object.asyncJestTest (/Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/jasmineAsyncInstall.js:102:37)\n    at /Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:43:12\n    at new Promise (<anonymous>)\n    at mapper (/Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:26:19)\n    at /Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:73:41\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)';

  it('Should populate ancestor titles', () => {
    const parseResults = {
      root: {
        name: 'a',
        type: ParsedNodeTypes.root,
        children: [
          {
            name: 'b',
            type: ParsedNodeTypes.describe,
            children: [
              {
                name: 'c',
                type: ParsedNodeTypes.describe,
                children: [
                  {
                    name: 'd',
                    type: ParsedNodeTypes.it,
                    children: [
                      {
                        name: 'e1',
                        type: ParsedNodeTypes.expect
                      },
                      {
                        name: 'e2',
                        type: ParsedNodeTypes.expect
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    };
    const expectedExtendedParseResults = Object.assign({}, parseResults, {
      itBlocksWithAncestorTitles: [
        Object.assign(
          {},
          parseResults.root.children[0].children[0].children[0],
          {
            ancestorTitles: ['a', 'b', 'c']
          }
        )
      ]
    });
    const extendedParseResults = populateAncestorTitles(
      parseResults as IExtendedParseResults
    );
    expect(extendedParseResults).to.eql(expectedExtendedParseResults);
  });

  it('Should extract position from failure message', () => {
    const position = extractPositionFromFailureMessage(
      mockFsPath,
      mockFailureMessage
    );
    expect(position!.line).to.equal(21);
    expect(position!.character).to.equal(4);
  });

  it('Should sanitize failure message', () => {
    const sanitizedMessage = sanitizeFailureMessage(mockFailureMessage);
    const expectedSanitizedMessage =
      'Error: expect(received).toEqual(expected) // deep equality\n\nExpected: 2\nReceived: 1\n    at Object.expect (/Users/mockUser/sfdx-simple/force-app/main/default/lwc/demoLwcComponent/__tests__/demoLwcComponent.test.js:22:5)\n    at Object.asyncJestTest (/Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/jasmineAsyncInstall.js:102:37)\n    at /Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:43:12\n    at new Promise (<anonymous>)\n    at mapper (/Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:26:19)\n    at /Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:73:41\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)';
    expect(sanitizedMessage).to.equal(expectedSanitizedMessage);
  });
});
