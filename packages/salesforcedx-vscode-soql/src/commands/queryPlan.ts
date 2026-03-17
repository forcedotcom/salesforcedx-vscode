/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { ContinueResponse, SfCommandlet } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { channelService } from '../services/channel';
import { getConnection } from '../services/org';
import { formatErrorMessage, GetQueryAndApiInputs, QueryAndApiInputs } from './queryUtils';

class QueryPlanExecutor {
  public async execute(response: ContinueResponse<QueryAndApiInputs>): Promise<void> {
    if (vscode.workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('clearOutputTab', false)) {
      channelService.clear();
    }

    const { query, api } = response.data;

    try {
      const connection = await getConnection();
      channelService.appendLine(nls.localize('query_plan_running'));

      const apiVersion = connection.getApiVersion();
      const encodedQuery = encodeURIComponent(query);
      const path =
        api === 'TOOLING'
          ? `/services/data/v${apiVersion}/tooling/query?explain=${encodedQuery}`
          : `/services/data/v${apiVersion}/query?explain=${encodedQuery}`;

      const result = await connection.request<unknown>(path);
      channelService.appendLine(JSON.stringify(result, null, 2));
      channelService.appendLine(nls.localize('query_plan_complete'));
    } catch (error) {
      channelService.appendLine(formatErrorMessage(error));
    } finally {
      channelService.show();
    }
  }
}

export const queryPlan = Effect.fn('sf.data.query.explain')(function* () {
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, new GetQueryAndApiInputs(), new QueryPlanExecutor());
  yield* Effect.promise(() => commandlet.run());
});
