/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { ExecuteAnonymousResult } from 'jsforce/lib/api/tooling';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ExecuteAnonymousError } from '../errors/executeAnonymousErrors';
import { ChannelService } from '../vscode/channelService';
import { ConnectionService } from './connectionService';
import { unknownToErrorCause } from './shared';

export type { ExecuteAnonymousResult } from 'jsforce/lib/api/tooling';

const ANON_APEX_ERRORS_COLLECTION = 'apex-anon-errors';
const UNEXPECTED_ERROR = 'Unexpected error during anonymous Apex execution';

const XML_CHAR_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;'
};

const escapeXml = (data: string): string => data.replaceAll(/[<>&'"]/g, char => XML_CHAR_MAP[char] ?? char);

const buildSoapBody = (accessToken: string, apexCode: string): string => {
  const escaped = escapeXml(apexCode);
  return `<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:cmd="http://soap.sforce.com/2006/08/apex"
xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <env:Header>
        <cmd:SessionHeader>
            <cmd:sessionId>${accessToken}</cmd:sessionId>
        </cmd:SessionHeader>
        <apex:DebuggingHeader><apex:debugLevel>DEBUGONLY</apex:debugLevel></apex:DebuggingHeader>
    </env:Header>
    <env:Body>
        <executeAnonymous xmlns="http://soap.sforce.com/2006/08/apex">
            <apexcode>${escaped}</apexcode>
        </executeAnonymous>
    </env:Body>
</env:Envelope>`;
};

export const buildSoapRequest = (instanceUrl: string, version: string, accessToken: string, apexCode: string) => {
  const orgId = accessToken.split('!')[0];
  const url = `${instanceUrl}/services/Soap/s/${version}/${orgId}`;
  return {
    method: 'POST' as const,
    url,
    body: buildSoapBody(accessToken, apexCode),
    headers: { 'content-type': 'text/xml', soapaction: 'executeAnonymous' }
  } as const;
};

type SoapResponseShape = {
  'soapenv:Envelope'?: {
    'soapenv:Header'?: { DebuggingInfo?: { debugLog?: string } };
    'soapenv:Body'?: {
      executeAnonymousResponse?: {
        result?: {
          column?: number;
          compiled?: string;
          compileProblem?: string | object;
          exceptionMessage?: string | object;
          exceptionStackTrace?: string | object;
          line?: number;
          success?: string;
        };
      };
    };
  };
};

const toStringOrNull = (v: string | object | undefined): string | null => (typeof v === 'object' ? null : (v ?? null));

type ParseSoapResult =
  | { success: true; result: ExecuteAnonymousResult; logBody: string }
  | { success: false; error: string };

const hasSoapEnvelope = (obj: unknown): obj is SoapResponseShape =>
  obj !== null && typeof obj === 'object' && 'soapenv:Envelope' in obj;

export const parseSoapResponse = (raw: unknown): ParseSoapResult => {
  const envelope = hasSoapEnvelope(raw) ? raw['soapenv:Envelope'] : undefined;
  const body = envelope?.['soapenv:Body'];
  const header = envelope?.['soapenv:Header'];
  const execResponse = body?.executeAnonymousResponse?.result;
  if (!execResponse) {
    return { success: false, error: 'Invalid SOAP response: missing executeAnonymousResponse.result' };
  }
  const logBody = (typeof header?.DebuggingInfo?.debugLog === 'string' && header.DebuggingInfo.debugLog) || '';
  const result: ExecuteAnonymousResult = {
    compiled: execResponse.compiled === 'true',
    success: execResponse.success === 'true',
    line: Number(execResponse.line) ?? 1,
    column: Number(execResponse.column) ?? 1,
    compileProblem: toStringOrNull(execResponse.compileProblem),
    exceptionMessage: toStringOrNull(execResponse.exceptionMessage),
    exceptionStackTrace: toStringOrNull(execResponse.exceptionStackTrace)
  };
  return { success: true, result, logBody };
};

export class ExecuteAnonymousService extends Effect.Service<ExecuteAnonymousService>()('ExecuteAnonymousService', {
  accessors: true,
  dependencies: [ConnectionService.Default, ChannelService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const diagnostics = vscode.languages.createDiagnosticCollection(ANON_APEX_ERRORS_COLLECTION);

    /** initiates an execute anonymous and retrieves the log.  Returns the result, log body, and log id */
    const executeAndRetrieveLog = Effect.fn('ExecuteAnonymousService.executeAndRetrieveLog')(function* (code: string) {
      const conn = yield* connectionService.getConnection();
      const version = conn.getApiVersion();
      const accessToken = conn.accessToken;
      if (!accessToken) {
        return yield* new ExecuteAnonymousError({
          message: 'Execute anonymous failed: no access token',
          cause: undefined
        });
      }
      const req = buildSoapRequest(conn.instanceUrl, version, accessToken, code);
      const raw = yield* Effect.tryPromise({
        try: () => conn.request(req),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new ExecuteAnonymousError({
            message: `Execute anonymous failed: ${cause.message}`,
            cause: error
          });
        }
      });
      const parsed = parseSoapResponse(raw);
      if (!parsed.success) {
        return yield* new ExecuteAnonymousError({
          message: parsed.error,
          cause: undefined
        });
      }
      return { result: parsed.result, logBody: parsed.logBody, logId: undefined };
    });

    /** Output result to channel; errors get full detail, success gets one line */
    const outputToChannel = Effect.fn('ExecuteAnonymousService.outputToChannel')(function* (
      result: ExecuteAnonymousResult
    ) {
      const channelService = yield* ChannelService;
      const text = result.success
        ? 'Execute anonymous succeeded.'
        : !result.compiled
          ? `Error: Line ${result.line}, Column ${result.column} -- ${result.compileProblem ?? UNEXPECTED_ERROR}`
          : `Compile: success / Error: ${result.exceptionMessage ?? UNEXPECTED_ERROR}\n${result.exceptionStackTrace ?? ''}`;
      yield* channelService.appendToChannel(text);
    });

    const setDiagnostics = (
      result: ExecuteAnonymousResult,
      documentUri: URI,
      selectionStartLine: number | undefined
    ): void => {
      diagnostics.delete(documentUri);
      if (result.success) return;
      const message =
        (result.compileProblem && result.compileProblem !== ''
          ? result.compileProblem
          : result.exceptionMessage && result.exceptionMessage !== ''
            ? result.exceptionMessage
            : UNEXPECTED_ERROR) ?? UNEXPECTED_ERROR;
      const line = result.line ? result.line + (selectionStartLine ?? 0) : 1;
      const column = result.column ?? 1;
      const pos = new vscode.Position(line > 0 ? line - 1 : 0, column > 0 ? column - 1 : 0);
      diagnostics.set(documentUri, [
        {
          message,
          severity: vscode.DiagnosticSeverity.Error,
          source: documentUri.fsPath ?? documentUri.path ?? documentUri.toString(),
          range: new vscode.Range(pos, pos)
        }
      ]);
    };

    const clearDiagnostics = Effect.fn('ExecuteAnonymousService.clearDiagnostics', {
      attributes: { telemetryIgnore: true } // produces way too many useless events
    })((documentUri: URI) => Effect.sync(() => diagnostics.delete(documentUri)));

    /** Report execute anonymous result via output channel and editor diagnostics. */
    const reportExecResult = Effect.fn('ExecuteAnonymousService.reportExecResult')(function* (
      result: ExecuteAnonymousResult,
      documentUri: URI,
      selectionStartLine?: number,
      logBody?: string
    ) {
      const channelService = yield* ChannelService;
      yield* channelService.clearChannel;
      yield* outputToChannel(result);
      if (logBody) {
        yield* channelService.appendToChannel(logBody);
      }
      const channel = yield* channelService.getChannel;
      yield* Effect.sync(() => channel.show());
      yield* Effect.sync(() => setDiagnostics(result, documentUri, selectionStartLine));
    });

    return {
      executeAndRetrieveLog,
      reportExecResult,
      clearDiagnostics
    };
  })
}) {}
