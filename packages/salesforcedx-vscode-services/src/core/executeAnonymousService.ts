/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { ExecuteAnonymousError } from '../errors/executeAnonymousErrors';
import { ApexLogService } from './apexLogService';
import { ConnectionService } from './connectionService';
import { unknownToErrorCause } from './shared';
import { TraceFlagService } from './traceFlagService';

export type { ExecuteAnonymousResult } from 'jsforce/lib/api/tooling';

const SHORT_LIVED_TRACE_FLAG_DURATION = Duration.minutes(5);

export class ExecuteAnonymousService extends Effect.Service<ExecuteAnonymousService>()('ExecuteAnonymousService', {
  accessors: true,
  dependencies: [ConnectionService.Default, TraceFlagService.Default, ApexLogService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const traceFlagService = yield* TraceFlagService;
    const logService = yield* ApexLogService;

    /** initiates an execute anonymous.  Returns only the json result */
    const executeAnonymous = Effect.fn('ExecuteAnonymousService.executeAnonymous')(function* (code: string) {
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
    });

    /** initiates an execute anonymous and retrieves the log.  Returns the result, log body, and log id */
    const executeAndRetrieveLog = Effect.fn('ExecuteAnonymousService.executeAndRetrieveLog')(function* (code: string) {
      const userId = yield* traceFlagService.getUserId();
      const { created, traceFlagId } = yield* traceFlagService.ensureTraceFlag(userId, SHORT_LIVED_TRACE_FLAG_DURATION);
      const result = yield* executeAnonymous(code);
      const logs = yield* logService.listLogs(5, {
        userId,
        operationContains: 'executeAnonymous'
      });
      // assumption: the user is not kicking off multiple execute anonymous operations at the same time
      // alternative is using the SOAP API to get the log result from the transaction
      const logId = logs[0]?.Id;
      const logBody = logId ? yield* logService.getLogBody(logId) : '';
      created && traceFlagId ? yield* traceFlagService.deleteTraceFlag(traceFlagId) : yield* Effect.void;
      return { result, logBody, logId };
    });

    return { executeAnonymous, executeAndRetrieveLog };
  })
}) {}
