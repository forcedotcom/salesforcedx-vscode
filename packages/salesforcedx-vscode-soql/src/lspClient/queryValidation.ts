/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { QueryValidationFeature } from '@salesforce/soql-language-server';
import { workspace } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { SOQL_CONFIGURATION_NAME, SOQL_VALIDATION_CONFIG } from '../constants';
import { QueryRunner } from '../editor/queryRunner';
import { withSFConnection } from '../sf';

export const init = (client: LanguageClient): LanguageClient => {
  client.registerFeature(new QueryValidationFeature());
  return client;
};

// When bundled and run in a pure JS env the RequestTypes.RunQuery enum is not defined
// so default to the string value here as a work around.
const runQueryString = 'runQuery';

const emptyQueryResults = { done: true, totalSize: 0, records: [] };
export const afterStart = (client: LanguageClient): LanguageClient => {
  client.onRequest('runQuery', async (queryText: string) => {
    const enabled = workspace.getConfiguration(SOQL_CONFIGURATION_NAME).get<boolean>(SOQL_VALIDATION_CONFIG);

    try {
      return enabled
        ? await withSFConnection(async conn => {
            const queryData = await new QueryRunner(conn).runQuery(queryText, {
              showErrors: false
            });
            return { result: queryData };
          })
        : emptyQueryResults;
    } catch (e) {
      // NOTE: The return value must be serializable, for JSON-RPC.
      // Thus we cannot include the exception object as-is
      return {
        error: {
          name: e.name,
          errorCode: e.errorCode,
          message: e.message
        }
      };
    }
  });

  return client;
};
