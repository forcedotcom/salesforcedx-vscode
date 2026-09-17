/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import { QueryService } from 'salesforcedx-vscode-services/out/src/core/queryService';
import { runQuery } from '../../../src/editor/queryRunner';

describe('runQuery ALL ROWS handling', () => {
  const makeHarness = () => {
    const query = jest.fn(() => Effect.succeed({ records: Stream.empty, totalSize: 0 }));
    const provider = {
      getServicesApi: Effect.succeed({ services: { QueryService } } as unknown as SalesforceVSCodeServicesApi)
    } as unknown as ExtensionProviderService;
    const queryService = new QueryService({ query } as unknown as QueryService);
    const run = (queryText: string) =>
      Effect.runPromise(
        runQuery(queryText, { showErrors: false }).pipe(
          Effect.provideService(ExtensionProviderService, provider),
          Effect.provideService(QueryService, queryService)
        )
      );
    return { query, run };
  };

  it('strips trailing ALL ROWS and passes scanAll true to QueryService', async () => {
    const { query, run } = makeHarness();
    await run('SELECT Id FROM Account ALL ROWS');
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ soql: 'SELECT Id FROM Account', scanAll: true }),
      expect.anything()
    );
  });

  it('passes scanAll false and unchanged text when ALL ROWS is absent', async () => {
    const { query, run } = makeHarness();
    await run('SELECT Id FROM Account');
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ soql: 'SELECT Id FROM Account', scanAll: false }),
      expect.anything()
    );
  });
});
