/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const dummyPullResult = {
  status: 0,
  result: {
    files: [
      {
        state: 'Created',
        fullName: 'F9',
        type: 'ApexClass',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/classes/F9.cls'
      },
      {
        state: 'Created',
        fullName: 'F9',
        type: 'ApexClass',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/classes/F9.cls-meta.xml'
      },
      {
        state: 'Changed',
        fullName: 'D9',
        type: 'ApexClass',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/classes/D9.cls'
      },
      {
        state: 'Changed',
        fullName: 'D9',
        type: 'ApexClass',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/classes/D9.cls-meta.xml'
      },
      {
        state: 'Changed',
        fullName: 'Admin',
        type: 'Profile',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/profiles/Admin.profile-meta.xml'
      }
    ]
  },
  warnings: [
    'We plan to deprecate this command in the future. Try using the "project retrieve start" command instead.',
    'The loglevel flag is no longer in use on this command. You may use it without error, but it will be ignored.\nSet the log level using the `SFDX_LOG_LEVEL` environment variable.'
  ]
};

export const dummyPushResult = {
  status: 0,
  result: {
    files: [
      {
        state: 'Changed',
        fullName: 'E1',
        type: 'ApexClass',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/classes/E1.cls'
      },
      {
        state: 'Changed',
        fullName: 'E1',
        type: 'ApexClass',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/classes/E1.cls-meta.xml'
      },
      {
        state: 'Created',
        fullName: 'G1',
        type: 'ApexClass',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/classes/G1.cls'
      },
      {
        state: 'Created',
        fullName: 'G1',
        type: 'ApexClass',
        filePath: '/Users/test.user/scratchpad/NewProj1/force-app/main/default/classes/G1.cls-meta.xml'
      }
    ]
  },
  warnings: []
};

export const dummyStdOut =
  '{\n  "status": 0,\n  "result": {\n    "files": [\n      {\n        "state": "Changed",\n        "fullName": "D9",\n        "type": "ApexClass",\n        "filePath": "/Users/kenneth.lewis/scratchpad/NewProj1/force-app/main/default/classes/D9.cls"\n      },\n      {\n        "state": "Changed",\n        "fullName": "D9",\n        "type": "ApexClass",\n        "filePath": "/Users/kenneth.lewis/scratchpad/NewProj1/force-app/main/default/classes/D9.cls-meta.xml"\n      }\n    ]\n  },\n  "warnings": [\n    "We plan to deprecate this command in the future. Try using the \\"project deploy start\\" command instead.",\n    "The loglevel flag is no longer in use on this command. You may use it without error, but it will be ignored.\\nSet the log level using the `SFDX_LOG_LEVEL` environment variable."\n  ]\n}\n';
