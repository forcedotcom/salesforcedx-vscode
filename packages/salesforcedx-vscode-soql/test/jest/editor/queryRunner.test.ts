/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { QueryService } from 'salesforcedx-vscode-services/out/src/core/queryService';
import { runQuery } from '../../../src/editor/queryRunner';

describe('runQuery ALL ROWS handling', () => {
  const conn = {} as Connection;

  const run = (queryText: string) => {
    const query = jest.fn(() => Effect.succeed({ records: [], totalSize: 0 }));
    return Effect.runPromise(
      runQuery(conn, queryText, { showErrors: false }).pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: { QueryService: Effect.succeed({ query }) }
          } as never)
        }),
        Effect.provide(QueryService.Default)
      )
    ).then(() => query);
  };

  it('strips trailing ALL ROWS and passes scanAll true', async () => {
    const query = await run('SELECT Id FROM Account ALL ROWS');
    expect(query).toHaveBeenCalledWith(
      conn,
      expect.objectContaining({ soql: 'SELECT Id FROM Account', scanAll: true, maxFetch: 50_000 }),
      expect.anything()
    );
  });

  it('passes scanAll false and unchanged text when ALL ROWS is absent', async () => {
    const query = await run('SELECT Id FROM Account');
    expect(query).toHaveBeenCalledWith(
      conn,
      expect.objectContaining({ soql: 'SELECT Id FROM Account', scanAll: false }),
      expect.anything()
    );
  });
});
