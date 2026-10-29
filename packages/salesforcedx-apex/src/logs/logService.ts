/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { JsonObject } from '../json';
import { type Connection, Logger, type Org, type StatusResult, StreamingClient } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { isUndefined } from 'effect/Predicate';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { ApexOperationError, causeMessage, getLogBody, getLogRecords, getLogs } from '../effect';
import { nls } from '../i18n';
import { elapsedTime } from '../utils/elapsedTime';
import { TraceFlags } from '../utils/traceFlags';
import { LISTENER_ABORTED_ERROR_NAME, LOG_TIMER_LENGTH_MINUTES, STREAMING_LOG_TOPIC } from './constants';
import { type ApexLogGetOptions, type LogRecord, type LogResult } from './types';

// Unwrap at the Promise boundary so CLI errors do not acquire a FiberFailure prefix.
const runLogOperation = async <A, E extends { message: string }>(operation: Effect.Effect<A, E>): Promise<A> =>
  Either.match(await operation.pipe(Effect.either, Effect.runPromise), {
    onLeft: error => {
      throw new Error(error.message);
    },
    onRight: result => result
  });

type StreamingLogMessage = {
  errorName?: string;
  sobject: { Id: string };
};

export class LogService {
  private readonly connection: Connection;
  private logger!: Logger;
  private logTailer?: (log: string) => void;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  @elapsedTime()
  public async getLogs(options: ApexLogGetOptions): Promise<LogResult[]> {
    const outputDir = options.outputDir;
    return runLogOperation(
      getLogs(
        this.connection,
        options,
        outputDir
          ? (fileName, body) =>
              Effect.tryPromise({
                try: async () => {
                  const logPath = path.join(outputDir, fileName);
                  await mkdir(outputDir, { recursive: true });
                  await writeFile(logPath, body);
                  return logPath;
                },
                catch: cause =>
                  new ApexOperationError({
                    operation: 'writeLog',
                    message: causeMessage(cause),
                    cause: causeMessage(cause)
                  })
              })
          : undefined
      ).pipe(Effect.map(logs => logs.map(({ log, logPath }) => (isUndefined(logPath) ? { log } : { log, logPath }))))
    );
  }

  @elapsedTime()
  private async getLogById(logId: string): Promise<LogResult> {
    return runLogOperation(getLogBody(this.connection, logId).pipe(Effect.map(log => ({ log }))));
  }

  @elapsedTime()
  public async getLogRecords(numberOfLogs?: number): Promise<LogRecord[]> {
    return runLogOperation(
      getLogRecords(this.connection, numberOfLogs).pipe(
        // Keep the legacy CLI type without rejecting nullable fields accepted by the shared API.
        Effect.map(records => records.map(({ LogUserId: _logUserId, ...record }) => record as LogRecord))
      )
    );
  }

  @elapsedTime()
  public async tail(org: Org, tailer?: (log: string) => void): Promise<void> {
    this.logger = await Logger.child('apexLogApi', { tag: 'tail' });
    this.logTailer = tailer;
    const stream = await this.createStreamingClient(org);

    this.logger.debug(nls.localize('startHandshake'));
    await stream.handshake();
    this.logger.debug(nls.localize('finishHandshake'));
    await stream.subscribe(async () => {
      this.logger.debug(nls.localize('subscribeStarted'));
    });
  }

  @elapsedTime()
  private async createStreamingClient(org: Org): Promise<StreamingClient> {
    const options = new StreamingClient.DefaultOptions(org, STREAMING_LOG_TOPIC, this.streamingCallback.bind(this));
    options.setSubscribeTimeout(Duration.minutes(LOG_TIMER_LENGTH_MINUTES));

    return await StreamingClient.create(options);
  }

  @elapsedTime()
  private async logCallback(message: StreamingLogMessage): Promise<void> {
    if (message.sobject?.Id) {
      const log = await this.getLogById(message.sobject.Id);
      if (log && this.logTailer) {
        this.logTailer(log.log);
      }
    }
  }

  @elapsedTime()
  private streamingCallback(rawMessage: JsonObject): StatusResult {
    const message = rawMessage as unknown as StreamingLogMessage;
    if (message.errorName === LISTENER_ABORTED_ERROR_NAME) {
      return { completed: true };
    }

    if (message.sobject?.Id) {
      void this.logCallback(message);
    }

    return { completed: false };
  }

  public async prepareTraceFlag(requestedDebugLevel: string): Promise<void> {
    const flags = new TraceFlags(this.connection);
    await flags.ensureTraceFlags(requestedDebugLevel);
  }
}
