/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { QueryValidationFeature } from '@salesforce/soql-language-server';
import { workspace } from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import { SOQL_CONFIGURATION_NAME, SOQL_VALIDATION_CONFIG } from '../constants';
import { runQuery } from '../editor/queryRunner';

export const init = (client: LanguageClient): LanguageClient => {
  const validationFeature = new QueryValidationFeature();
  if (typeof validationFeature.initialize === 'function') {
    validationFeature.initialize();
  }
  // class exists in soql-language-server, but does not match vscode "Feature" interface
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  client.registerFeature(validationFeature as any);
  return client;
};

export const afterStart = (client: LanguageClient): LanguageClient => {
  client.onRequest('runQuery', async (queryText: string) => {
    const enabled = workspace.getConfiguration(SOQL_CONFIGURATION_NAME).get<boolean>(SOQL_VALIDATION_CONFIG);

    try {
      return enabled
        ? {
            // @ts-expect-error - mismatch in Logger between core and core-bundle
            result: await runQuery(await WorkspaceContextUtil.getInstance().getConnection())(queryText, {
              showErrors: false
            })
          }
        : { done: true, totalSize: 0, records: [] };
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
