/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { EffectApexLogGetOptions } from '../effect/schema/logs';
import type { JsonObject } from '../json';
import { type Connection, Logger, type Org, type StatusResult, StreamingClient } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as path from 'node:path';
import { FileOutput } from '../effect/fileOutput';
import { getLogBody, getLogRecords as getEffectLogRecords, getLogs as getEffectLogs } from '../effect/logs';
import { NodeFileOutput } from '../effect/nodeFileOutputLayer';
import { nls } from '../i18n';
import { ApexLogId } from '../schemas/salesforceId';
import { elapsedTime } from '../utils/elapsedTime';
import { createFile } from '../utils/fileSystemHandler';
import { ensureTraceFlags } from '../utils/traceFlags';
import { LISTENER_ABORTED_ERROR_NAME, LOG_TIMER_LENGTH_MINUTES, STREAMING_LOG_TOPIC } from './constants';
import { type ApexLogGetOptions, type LogRecord, type LogResult } from './types';

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
  private readonly fileOutput: typeof FileOutput.Service;
  private logger!: Logger;
  private logTailer?: (log: string) => void;

  constructor(connection: Connection, fileOutput: typeof FileOutput.Service = NodeFileOutput) {
    this.connection = connection;
    this.fileOutput = fileOutput;
  }

  @elapsedTime()
  public async getLogs(options: ApexLogGetOptions): Promise<LogResult[]> {
    const effectOptions: EffectApexLogGetOptions | undefined = isUndefined(options.logId)
      ? isUndefined(options.numberOfLogs)
        ? undefined
        : { numberOfLogs: options.numberOfLogs }
      : isUndefined(options.numberOfLogs)
        ? { logId: options.logId }
        : { logId: options.logId, numberOfLogs: options.numberOfLogs };
    if (isUndefined(effectOptions)) throw new Error(nls.localize('missingInfoLogError'));

    const outputDir = options.outputDir;
    if (outputDir) {
      const writeLog = (fileName: string, body: string) =>
        createFile(path.join(outputDir, fileName), body).pipe(Effect.provideService(FileOutput, this.fileOutput));
      return runLogOperation(getEffectLogs(this.connection, effectOptions, writeLog)).then(logs =>
        logs.map(({ log, logPath }) => (isUndefined(logPath) ? { log } : { log, logPath }))
      );
    }
    return runLogOperation(getEffectLogs(this.connection, effectOptions)).then(logs =>
      logs.map(({ log }) => ({ log }))
    );
  }

  @elapsedTime()
  private async getLogById(logId: string): Promise<LogResult> {
    return {
      log: await runLogOperation(
        Schema.decodeUnknown(ApexLogId)(logId).pipe(
          Effect.flatMap(decodedLogId => getLogBody(this.connection, decodedLogId))
        )
      )
    };
  }

  @elapsedTime()
  public async getLogRecords(numberOfLogs?: number): Promise<readonly LogRecord[]> {
    return runLogOperation(getEffectLogRecords(this.connection, numberOfLogs));
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

  @elapsedTime()
  public async prepareTraceFlag(requestedDebugLevel: string): Promise<void> {
    await ensureTraceFlags(this.connection, requestedDebugLevel);
  }
}
