/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as path from 'node:path';
import * as Tracer from 'effect/Tracer';
import * as vscode from 'vscode';
import { extractErrorMessage, initSObjectDefinitions } from '../../../src/commands/refreshSObjects';

vi.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  fileOrFolderExists: vi.fn()
}));

const fileOrFolderExistsMock = vi.mocked(fileOrFolderExists);
type RecordedSpan = {
  name: string;
  attributes: Map<string, unknown>;
  parent: Tracer.Span['parent'];
  ended: boolean;
  result?: 'success' | 'failure';
};
const recordedSpans: RecordedSpan[] = [];
const recordingTracerLayer = Layer.setTracer(
  Tracer.make({
    span: (name, parent, context, links, startTime, kind, spanOptions) => {
      const attributes = new Map<string, unknown>(Object.entries(spanOptions?.attributes ?? {}));
      const recordedSpan: RecordedSpan = { name, attributes, parent, ended: false };
      recordedSpans.push(recordedSpan);
      return {
        _tag: 'Span',
        name,
        spanId: `span-${recordedSpans.length}`,
        traceId: 'trace',
        parent,
        context,
        links,
        status: { _tag: 'Started', startTime },
        attributes,
        sampled: true,
        kind,
        end: (_endTime, exit) => {
          recordedSpan.ended = true;
          recordedSpan.result = Exit.isFailure(exit) ? 'failure' : 'success';
        },
        attribute: (key: string, value: unknown) => attributes.set(key, value),
        event: () => {},
        addLinks: () => {}
      } as Tracer.Span;
    },
    context: <A>(f: () => A) => f()
  })
);

const runWithRecordingTracer = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(recordingTracerLayer)));

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
    fileOrFolderExistsMock.mockReset();
    vi.mocked(vscode.commands.executeCommand).mockReset().mockResolvedValue(undefined);
  });

  it.each([
    [true, 'startup', path.join('/project', '.sfdx', 'tools', 'sobjects')],
    [false, 'startupmin', path.join('/project', '.sfdx', 'tools', 'sobjects', 'standardObjects')]
  ])('records the %s setting refresh span', async (isSettingEnabled, refreshSource, sobjectFolder) => {
    fileOrFolderExistsMock.mockResolvedValue(false);

    await runWithRecordingTracer(initSObjectDefinitions('/project', isSettingEnabled));

    expect(fileOrFolderExistsMock).toHaveBeenCalledWith(sobjectFolder);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.internal.refreshsobjects', refreshSource);
    const notificationSpan = recordedSpans.find(span => span.name === 'sObjectRefreshNotification');
    expect(notificationSpan).toEqual(expect.objectContaining({ ended: true, result: 'success' }));
    expect(notificationSpan?.parent._tag).toBe('None');
    expect(notificationSpan?.attributes.get('type')).toBe(refreshSource);
  });

  it('does not refresh or record a notification when definitions exist', async () => {
    fileOrFolderExistsMock.mockResolvedValue(true);

    await runWithRecordingTracer(initSObjectDefinitions('/project', true));

    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(recordedSpans.some(span => span.name === 'sObjectRefreshNotification')).toBe(false);
  });

  it('records command errors and preserves the failure', async () => {
    fileOrFolderExistsMock.mockResolvedValue(false);
    const error = new Error('boom');
    vi.mocked(vscode.commands.executeCommand).mockRejectedValue(error);

    await expect(runWithRecordingTracer(initSObjectDefinitions('/project', true))).rejects.toThrow('boom');

    const errorSpan = recordedSpans.find(span => span.name === 'initSObjectDefinitionsError');
    expect(errorSpan).toEqual(expect.objectContaining({ ended: true, result: 'failure' }));
    expect(errorSpan?.parent._tag).toBe('None');
    expect(errorSpan?.attributes.get('message')).toBe('Error: boom with sobjectRefreshStartup = true');
  });
});
