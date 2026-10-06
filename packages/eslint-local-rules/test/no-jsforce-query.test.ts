/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noJsforceQuery } from '../src/noJsforceQuery';

const fixtureDir = join(__dirname, 'fixtures/no-jsforce-query');
const filename = join(fixtureDir, 'subject.ts');

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: fixtureDir
    }
  }
});

ruleTester.run('no-jsforce-query', noJsforceQuery, {
  valid: [
    {
      filename,
      code: `
import type { Connection } from 'jsforce';
declare const connection: Connection;
declare const queryService: { query: (soql: string) => void; queryMore: (locator: string) => void };
declare const database: { query: (sql: string) => void; queryMore: (cursor: string) => void };
declare const methodName: string;
queryService.query('SELECT Id FROM Account');
queryService.queryMore('locator');
database.query('SELECT * FROM accounts');
database.queryMore('cursor');
connection.bulk2.query('SELECT Id FROM Account');
connection[methodName]('SELECT Id FROM Account');
`
    },
    {
      filename,
      code: `
type ConnectionLike = { query: (soql: string) => void; queryMore: (locator: string) => void };
declare const connection: ConnectionLike;
connection.query('SELECT Id FROM Account');
connection.queryMore('locator');
`
    }
  ],
  invalid: [
    {
      filename,
      code: `
import type { Connection } from 'jsforce';
import type { Connection as SalesforceConnection } from '@salesforce/core';
class DerivedConnection extends Connection {}
declare const connection: Connection;
declare const coreConnection: SalesforceConnection;
declare const derivedConnection: DerivedConnection;
connection.query('SELECT Id FROM Account');
connection['query']('SELECT Id FROM Contact');
connection.queryMore('locator');
connection.tooling.query('SELECT Id FROM ApexClass');
connection.tooling.queryMore('locator');
coreConnection.query('SELECT Id FROM Account');
coreConnection.tooling.query('SELECT Id FROM ApexClass');
derivedConnection.queryMore('locator');
const queryGeneric = <C extends Connection>(genericConnection: C) => genericConnection.query('SELECT Id FROM Account');
queryGeneric(connection);
`,
      errors: [
        { messageId: 'query' },
        { messageId: 'query' },
        { messageId: 'queryMore' },
        { messageId: 'query' },
        { messageId: 'queryMore' },
        { messageId: 'query' },
        { messageId: 'query' },
        { messageId: 'queryMore' },
        { messageId: 'query' }
      ]
    }
  ]
});
