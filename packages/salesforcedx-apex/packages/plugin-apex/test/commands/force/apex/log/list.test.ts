/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, test } from '@salesforce/command/lib/test';
import { LogService } from '@salesforce/apex-node';

const rawLogResult = {
  status: 0,
  result: {
    '0': {
      Id: '07L5tgg0005PGdTnEAL',
      Application: 'Unknown',
      DurationMilliseconds: 75,
      Location: 'Unknown',
      LogLength: 450,
      LogUser: {
        Name: 'Test User',
        attributes: {}
      },
      Operation: 'API',
      Request: 'API',
      StartTime: '2020-10-13T05:39:43.000+0000',
      Status: 'Assertion Failed'
    },
    '1': {
      Id: '07L5tgg0005PGdTnFPL',
      Application: 'Unknown',
      DurationMilliseconds: 75,
      Location: 'Unknown',
      LogLength: 450,
      LogUser: {
        Name: 'Test User2',
        attributes: {}
      },
      Operation: 'API',
      Request: 'API',
      StartTime: '2020-10-13T05:39:43.000+0000',
      Status: 'Successful'
    }
  }
};

const cleanResult = {
  status: 0,
  result: [
    {
      Id: '07L5tgg0005PGdTnEAL',
      Application: 'Unknown',
      DurationMilliseconds: 75,
      Location: 'Unknown',
      LogLength: 450,
      LogUser: {
        Name: 'Test User',
        attributes: {}
      },
      Operation: 'API',
      Request: 'API',
      StartTime: '2020-10-13T05:39:43+0000',
      Status: 'Assertion Failed'
    },
    {
      Id: '07L5tgg0005PGdTnFPL',
      Application: 'Unknown',
      DurationMilliseconds: 75,
      Location: 'Unknown',
      LogLength: 450,
      LogUser: {
        Name: 'Test User2',
        attributes: {}
      },
      Operation: 'API',
      Request: 'API',
      StartTime: '2020-10-13T05:39:43+0000',
      Status: 'Successful'
    }
  ]
};

const logRecords = [rawLogResult.result[0], rawLogResult.result[1]];

describe('force:apex:log:list', () => {
  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'getLogRecords', () => logRecords)
    .stdout()
    .command(['force:apex:log:list', '--targetusername', 'test@username.com'])
    .it('runs default command with cleaned table output', ctx => {
      let r =
        'APPLICATION  DURATION (MS)  ID                   LOCATION  SIZE (B)  LOG USER    OPERATION  REQUEST  START TIME                STATUS          ';
      r +=
        '\n───────────  ─────────────  ───────────────────  ────────  ────────  ──────────  ─────────  ───────  ────────────────────────  ────────────────\nUnknown';
      r +=
        '      75             07L5tgg0005PGdTnEAL  Unknown   450       Test User   API        API      2020-10-13T05:39:43+0000  Assertion Failed\nUnknown';
      r +=
        '      75             07L5tgg0005PGdTnFPL  Unknown   450       Test User2  API        API      2020-10-13T05:39:43+0000  Successful      \n\n';
      expect(ctx.stdout).to.equal(r);
    });

  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'getLogRecords', () => logRecords)
    .stdout()
    .command([
      'force:apex:log:list',
      '--targetusername',
      'test@username.com',
      '--json'
    ])
    .it(
      'should return cleaned log records with json parameter specified',
      ctx => {
        const expectedResult = JSON.stringify(cleanResult, null, 2);
        expect(ctx.stdout).to.equal(`${expectedResult}\n`);
      }
    );

  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'getLogRecords', () => [])
    .stdout()
    .command([
      'force:apex:log:list',
      '--targetusername',
      'test@username.com',
      '--json'
    ])
    .it('should return json output if no logs were found', ctx => {
      const emptyResult = JSON.stringify({ status: 0, result: [] }, null, 2);
      expect(ctx.stdout).to.equal(`${emptyResult}\n`);
    });

  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'getLogRecords', () => [])
    .stdout()
    .command(['force:apex:log:list', '--targetusername', 'test@username.com'])
    .it('should correct message if no logs were found', ctx => {
      expect(ctx.stdout).to.equal(`No debug logs found in org\n`);
    });
});
