/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { ExecuteAnonymousError } from '../errors/executeAnonymousErrors';
import { ConnectionService } from './connectionService';
import { unknownToErrorCause } from './shared';

export type { ExecuteAnonymousResult } from 'jsforce/lib/api/tooling';

export class ExecuteAnonymousService extends Effect.Service<ExecuteAnonymousService>()(
  'ExecuteAnonymousService',
  {
    accessors: true,
    dependencies: [ConnectionService.Default],
    effect: Effect.gen(function* () {
      const connectionService = yield* ConnectionService;

      const executeAnonymous = Effect.fn('ExecuteAnonymousService.executeAnonymous')(
        function* (code: string) {
          const conn = yield* connectionService.getConnection();
          return yield* Effect.tryPromise({
            try: () => conn.tooling.executeAnonymous(code),
            catch: error => {
              const { cause } = unknownToErrorCause(error);
              return new ExecuteAnonymousError({
                message: `Execute anonymous failed: ${cause.message}`,
                cause: error
              });
            }
          });
        }
      );

      return { executeAnonymous };
    })
  }
) {}
