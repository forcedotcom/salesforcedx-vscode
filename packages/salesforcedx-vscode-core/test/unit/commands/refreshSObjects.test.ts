/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Tracer from 'effect/Tracer';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { FsService, type SalesforceVSCodeServicesApiV2 } from '@salesforce/vscode-services/v2';
import { extractErrorMessage, initSObjectDefinitions } from '../../../src/commands/refreshSObjects';

const fileOrFolderExists = vi.fn((_filePath: string) => Effect.succeed(false));
const fsLayer = Layer.mergeAll(
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({ v2: { services: { FsService } } } as unknown as SalesforceVSCodeServicesApiV2)
  } as unknown as ExtensionProviderService['Service']),
  Layer.succeed(FsService, FsService.of({ fileOrFolderExists } as never))
);
type RecordedSpan = {
  name: string;
  attributes: Map<string, unknown>;
  parent: Tracer.Span['parent'];
  ended: boolean;
  result?: 'success' | 'failure';
};
const recordedSpans: RecordedSpan[] = [];
const recordingTracerLayer = Layer.succeed(
  Tracer.Tracer,
  Tracer.make({
    span: options => {
      const span = new Tracer.NativeSpan(options);
      const recordedSpan: RecordedSpan = {
        name: span.name,
        attributes: span.attributes,
        parent: span.parent,
        ended: false
      };
      recordedSpans.push(recordedSpan);
      const end = span.end.bind(span);
      span.end = (endTime, exit) => {
        recordedSpan.ended = true;
        recordedSpan.result = Exit.isFailure(exit) ? 'failure' : 'success';
        end(endTime, exit);
      };
      return span;
    }
  })
);

const runWithRecordingTracer = <A, E>(effect: Effect.Effect<A, E, ExtensionProviderService | FsService>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(Layer.mergeAll(recordingTracerLayer, fsLayer))) as Effect.Effect<A, E, never>
  );

describe('extractErrorMessage', () => {
  it('returns the message of an Error instance', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the nested error message from { error: Error }', () => {
    expect(extractErrorMessage({ error: new Error('nested') })).toBe('nested');
  });

  it('returns the message from { message: string }', () => {
    expect(extractErrorMessage({ message: 'plain' })).toBe('plain');
  });

  it('does not treat an array as a record (array-exclusion) and falls through to String()', () => {
    expect(extractErrorMessage([])).toBe('');
  });

  it.each([
    ['a string primitive', 'oops', 'oops'],
    ['a number primitive', 42, '42'],
    ['undefined', undefined, 'undefined'],
    ['null', null, 'null']
  ])('stringifies %s', (_label, input, expected) => {
    expect(extractErrorMessage(input)).toBe(expected);
  });
});

describe('initSObjectDefinitions', () => {
  beforeEach(() => {
    recordedSpans.length = 0;
    fileOrFolderExists.mockReset();
    vi.mocked(vscode.commands.executeCommand).mockReset().mockResolvedValue(undefined);
  });

  it.each([
    [true, 'startup', path.join('/project', '.sfdx', 'tools', 'sobjects')],
    [false, 'startupmin', path.join('/project', '.sfdx', 'tools', 'sobjects', 'standardObjects')]
  ])('records the %s setting refresh span', async (isSettingEnabled, refreshSource, sobjectFolder) => {
    fileOrFolderExists.mockReturnValue(Effect.succeed(false));

    await runWithRecordingTracer(initSObjectDefinitions('/project', isSettingEnabled));

    expect(fileOrFolderExists).toHaveBeenCalledWith(sobjectFolder);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.internal.refreshsobjects', refreshSource);
    const notificationSpan = recordedSpans.find(span => span.name === 'sObjectRefreshNotification');
    expect(notificationSpan).toEqual(expect.objectContaining({ ended: true, result: 'success' }));
    expect(notificationSpan && Option.isNone(notificationSpan.parent)).toBe(true);
    expect(notificationSpan?.attributes.get('type')).toBe(refreshSource);
  });

  it('does not refresh or record a notification when definitions exist', async () => {
    fileOrFolderExists.mockReturnValue(Effect.succeed(true));

    await runWithRecordingTracer(initSObjectDefinitions('/project', true));

    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(recordedSpans.some(span => span.name === 'sObjectRefreshNotification')).toBe(false);
  });

  it('records command errors and preserves the failure', async () => {
    fileOrFolderExists.mockReturnValue(Effect.succeed(false));
    const error = new Error('boom');
    vi.mocked(vscode.commands.executeCommand).mockRejectedValue(error);

    await expect(runWithRecordingTracer(initSObjectDefinitions('/project', true))).rejects.toThrow('boom');

    const errorSpan = recordedSpans.find(span => span.name === 'initSObjectDefinitionsError');
    expect(errorSpan).toEqual(expect.objectContaining({ ended: true, result: 'failure' }));
    expect(errorSpan && Option.isNone(errorSpan.parent)).toBe(true);
    expect(errorSpan?.attributes.get('message')).toBe('Error: boom with sobjectRefreshStartup = true');
  });
});
